import { useCallback, useEffect, useRef, useState } from "react";
import { api, getJson, sendJson } from "../lib/http";

type Conversation = { id: number; title: string; createdAt: string };
type Message = { id: number; role: string; content: string; createdAt: string };
type GeneratedImage = { prompt: string; dataUrl: string };
type ImageGenerationState = { phase: "generating" | "sketching" | "completed"; prompt: string; dataUrl?: string };

const GENERATED_IMAGE_PREFIX = "__PAYVORA_GENERATED_IMAGE__:";

const isImageGenerationPrompt = (content: string): boolean =>
  /\b(?:generate|create|make|draw|illustrate|render|paint|design)\b[\s\S]{0,100}\b(?:image|picture|photo|illustration|artwork|visual)\b|\b(?:image|picture|photo|illustration|artwork|visual)\b[\s\S]{0,100}\b(?:generate|create|make|draw|illustrate|render|paint)\b/i.test(content);

function decodeGeneratedImage(content: string): GeneratedImage | null {
  if (!content.startsWith(GENERATED_IMAGE_PREFIX)) return null;
  try {
    const value = JSON.parse(content.slice(GENERATED_IMAGE_PREFIX.length)) as Partial<GeneratedImage>;
    if (typeof value.prompt === "string" && typeof value.dataUrl === "string" && value.dataUrl.startsWith("data:image/")) return value as GeneratedImage;
  } catch {
    /* Keep malformed historical messages visible as ordinary text. */
  }
  return null;
}

type Props = {
  activeConversationId?: number | null;
  onConversationCreated?: (id: number) => void;
  /** Called after a reply finishes streaming (titles may have changed server-side). */
  onConversationsChanged?: () => void;
  /** Message to send automatically on mount (e.g. handed off from the dashboard composer). */
  initialMessage?: string;
};

const CARD = "var(--pv-card)";
const BORDER = "var(--pv-border)";
const TEXT = "var(--pv-text)";
const MUTED = "var(--pv-text-muted)";
const BRAND = "var(--pv-brand)";

export default function ChatPanel({ activeConversationId = null, onConversationCreated, onConversationsChanged, initialMessage }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convId, setConvId] = useState<number | null>(activeConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [imageGeneration, setImageGeneration] = useState<ImageGenerationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Abort any in-flight stream when the panel unmounts (e.g. New chat / opening
  // a Recent mid-stream) so callbacks stop and the server persists the partial.
  useEffect(() => () => abortRef.current?.abort(), []);

  const loadConversations = useCallback(async () => {
    setLoadingConvos(true);
    try {
      const data = await getJson<{ conversations: Conversation[] }>("/chat/conversations");
      setConversations(data.conversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversations.");
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => { void loadConversations(); }, [loadConversations]);
  useEffect(() => { if (activeConversationId != null) setConvId(activeConversationId); }, [activeConversationId]);

  const loadMessages = useCallback(async (id: number) => {
    setLoadingMsgs(true);
    setError(null);
    try {
      const data = await getJson<{ messages: Message[] }>(`/chat/conversations/${id}/messages`);
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages.");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  // When send() creates the conversation itself, the optimistic message is already
  // on screen — reloading from the server would race the stream and duplicate it.
  const skipNextLoadRef = useRef(false);

  useEffect(() => {
    if (convId == null) { setMessages([]); return; }
    if (skipNextLoadRef.current) { skipNextLoadRef.current = false; return; }
    void loadMessages(convId);
  }, [convId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamText]);

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (convId != null) return convId;
    const convo = await sendJson<Conversation>("/chat/conversations", "POST", { title: "New conversation" });
    skipNextLoadRef.current = true;
    setConvId(convo.id);
    setConversations(prev => [convo, ...prev]);
    onConversationCreated?.(convo.id);
    return convo.id;
  }, [convId, onConversationCreated]);

  const send = useCallback(async (forced?: string) => {
    const content = (forced ?? input).trim();
    if (!content || streaming) return;
    const imageRequest = isImageGenerationPrompt(content);
    setError(null);
    setInput("");
    let id: number;
    try {
      id = await ensureConversation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start a conversation.");
      return;
    }
    const userMsg: Message = { id: Date.now(), role: "user", content, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setStreaming(true);
    setStreamText("");
    if (imageRequest) setImageGeneration({ phase: "generating", prompt: content });
    const controller = new AbortController();
    abortRef.current = controller;
    let assembled = "";
    let generatedImage: GeneratedImage | null = null;
    try {
      const res = await fetch(api(`/chat/conversations/${id}/messages`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        let msg = `Request failed (${res.status}).`;
        try { const b = await res.json(); if (b?.message) msg = b.message; } catch { /* keep */ }
        throw new Error(msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          try {
            const obj = JSON.parse(payload) as {
              content?: string;
              done?: boolean;
              error?: string;
              status?: "generating" | "sketching";
              image?: GeneratedImage;
            };
            if (obj.error) throw new Error(obj.error);
            if (obj.status && imageRequest) {
              setImageGeneration(current => current ? { ...current, phase: obj.status! } : current);
            }
            if (obj.image?.dataUrl && imageRequest) {
              generatedImage = obj.image;
              setImageGeneration(current => current ? { ...current, phase: "completed", dataUrl: obj.image!.dataUrl } : current);
            }
            if (obj.content) { assembled += obj.content; setStreamText(assembled); }
          } catch (err) {
            if (err instanceof Error && err.message !== "Unexpected end of JSON input") throw err;
          }
        }
      }
      if (generatedImage) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          role: "assistant",
          content: `${GENERATED_IMAGE_PREFIX}${JSON.stringify(generatedImage)}`,
          createdAt: new Date().toISOString(),
        }]);
      } else if (assembled) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: assembled, createdAt: new Date().toISOString() }]);
      }
      setStreamText("");
      setImageGeneration(null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        if (assembled) setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: assembled + " …(stopped)", createdAt: new Date().toISOString() }]);
      } else {
        setError(e instanceof Error ? e.message : "AI request failed.");
      }
      setStreamText("");
      setImageGeneration(null);
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Refresh titles on every outcome (success, stop, error) — the server
      // auto-titles the conversation from the first user message.
      void loadConversations();
      onConversationsChanged?.();
    }
  }, [input, streaming, ensureConversation, loadConversations, onConversationsChanged]);

  const stop = () => abortRef.current?.abort();

  const initialSentRef = useRef(false);
  useEffect(() => {
    if (initialMessage?.trim() && !initialSentRef.current) {
      initialSentRef.current = true;
      void send(initialMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newChat = () => { if (streaming) return; setConvId(null); setMessages([]); setError(null); setImageGeneration(null); };

  const rename = async (id: number) => {
    const current = conversations.find(c => c.id === id)?.title ?? "";
    const title = window.prompt("Rename conversation", current);
    if (title == null || !title.trim()) return;
    try {
      await sendJson(`/chat/conversations/${id}`, "PATCH", { title: title.trim() });
      setConversations(prev => prev.map(c => (c.id === id ? { ...c, title: title.trim() } : c)));
    } catch (e) { setError(e instanceof Error ? e.message : "Rename failed."); }
  };

  const remove = async (id: number) => {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await sendJson(`/chat/conversations/${id}`, "DELETE");
      setConversations(prev => prev.filter(c => c.id !== id));
      if (convId === id) newChat();
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  };

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", background: "var(--pv-page)", color: TEXT }}>
      {/* Conversation switcher */}
      <aside className="chat-conv-aside" style={{ width: 240, borderRight: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", background: CARD }}>
        <div style={{ padding: 12, borderBottom: `1px solid ${BORDER}` }}>
          <button onClick={newChat} disabled={streaming} style={btnPrimary(streaming)}>+ New chat</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {loadingConvos ? (
            [0, 1, 2].map(i => <div key={i} style={skeleton(28)} />)
          ) : conversations.length === 0 ? (
            <p style={{ fontSize: 12, color: MUTED, padding: 8 }}>No conversations yet. Start a new chat.</p>
          ) : (
            conversations.map(c => (
              <div key={c.id} className="pv-chat-convo" style={{
                display: "flex", alignItems: "center", gap: 4, padding: "8px 10px", borderRadius: 10, cursor: "pointer",
                background: c.id === convId ? "var(--pv-hover)" : "transparent", marginBottom: 2,
              }} onClick={() => setConvId(c.id)}>
                <span style={{ flex: 1, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                <button title="Rename" onClick={e => { e.stopPropagation(); void rename(c.id); }} style={iconBtn}>✎</button>
                <button title="Delete" onClick={e => { e.stopPropagation(); void remove(c.id); }} style={iconBtn}>🗑</button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div ref={scrollRef} data-payvora-scrollbar-root style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loadingMsgs ? (
            [0, 1, 2].map(i => <div key={i} style={skeleton(48)} />)
          ) : messages.length === 0 && !streamText && !imageGeneration ? (
            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: MUTED }}>
              <p style={{ fontSize: 18, fontWeight: 600, color: TEXT, letterSpacing: "-0.01em" }}>Start a conversation</p>
              <p style={{ fontSize: 13 }}>Ask anything — Payvora's assistant streams responses in real time.</p>
            </div>
          ) : (
            <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {messages.map(m => <Bubble key={m.id} role={m.role} content={m.content} />)}
              {streamText && <Bubble role="assistant" content={streamText} streaming />}
               {imageGeneration && <ImageGenerationCard key="image-generation" phase={imageGeneration.phase} prompt={imageGeneration.prompt} dataUrl={imageGeneration.dataUrl} />}
            </div>
          )}
        </div>

        {error && (
          <div style={{ margin: "0 24px 8px", padding: "8px 12px", borderRadius: 10, background: "rgba(220,38,38,0.1)", color: "#dc2626", fontSize: 13, border: "1px solid rgba(220,38,38,0.25)" }}>
            {error}
          </div>
        )}

        {/* ChatGPT-style pill composer */}
        <div style={{ padding: "6px 16px calc(16px + env(safe-area-inset-bottom))" }}>
          <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", alignItems: "center", gap: 4, padding: "7px 8px 7px 16px", borderRadius: 28, background: "var(--pv-input-bg)", border: `1px solid ${BORDER}`, boxShadow: "var(--pv-pill-shadow)" }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder="Ask Payvora"
              rows={1}
              style={{
                flex: 1, minWidth: 0, resize: "none", maxHeight: 160, padding: "9px 4px", border: "none",
                background: "transparent", color: TEXT, fontSize: 16, lineHeight: 1.5, fontFamily: "inherit", outline: "none",
              }}
            />
            {streaming ? (
              <button onClick={stop} aria-label="Stop generating" style={roundBlueBtn}>
                <svg width="13" height="13" viewBox="0 0 12 12"><rect x="1" y="1" width="10" height="10" rx="2.5" fill="#fff" /></svg>
              </button>
            ) : (
              <button onClick={() => void send()} disabled={!input.trim()} aria-label="Send message" style={{ ...roundBlueBtn, opacity: input.trim() ? 1 : 0.55, cursor: input.trim() ? "pointer" : "not-allowed" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content, streaming }: { role: string; content: string; streaming?: boolean }) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };
  if (isUser) {
    // Reference style: gray pill on the right
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ maxWidth: "80%", padding: "11px 16px", borderRadius: 20, fontSize: 16, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "var(--pv-hover)", color: "var(--pv-text)" }}>
          {content}
        </div>
      </div>
    );
  }
  const generatedImage = decodeGeneratedImage(content);
  if (generatedImage) return <GeneratedImageBubble image={generatedImage} />;
  // Reference style: assistant replies are plain text, with an action row underneath
  return (
    <div>
      <div style={{ fontSize: 16, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--pv-text)" }}>
        {content || "…"}
      </div>
      {!streaming && content && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
          <button onClick={() => void copy()} title={copied ? "Copied" : "Copy"} aria-label="Copy response" style={msgActionBtn}>
            {copied ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="var(--pv-text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="var(--pv-text-secondary)" strokeWidth="1.4"/><path d="M10.5 5.5v-1a2 2 0 00-2-2h-4a2 2 0 00-2 2v4a2 2 0 002 2h1" stroke="var(--pv-text-secondary)" strokeWidth="1.4"/></svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

const IMAGE_DOTS = Array.from({ length: 140 }, (_, index) => index);

function ImageGenerationCard({ phase, prompt, dataUrl }: { phase: ImageGenerationState["phase"]; prompt: string; dataUrl?: string }) {
  const status = phase === "sketching" ? "Sketching it out" : "Creating image";
  return (
    <div className={`pv-image-generation-card${dataUrl ? " pv-image-generation-card--completed" : ""}`} role="status" aria-label={dataUrl ? "Generated image" : `${status} for ${prompt}`}>
      {dataUrl ? (
        <img className="pv-generated-image" src={dataUrl} alt={prompt} />
      ) : (
        <>
          <div className="pv-image-generation-status" key={status}>{status}</div>
          <div className="pv-image-dot-field" aria-hidden="true">
            {IMAGE_DOTS.map(index => (
              <span
                key={index}
                className="pv-image-dot"
                style={{
                  "--pv-dot-delay": `${(index % 17) * -110}ms`,
                  "--pv-dot-opacity": `${0.2 + ((index * 13) % 7) * 0.08}`,
                  "--pv-dot-shift-x": `${((index * 7) % 9) - 4}px`,
                  "--pv-dot-shift-y": `${((index * 11) % 7) - 3}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GeneratedImageBubble({ image }: { image: GeneratedImage }) {
  return (
    <div className="pv-generated-image-message">
      <div className="pv-image-generation-card pv-image-generation-card--completed" role="img" aria-label={`Generated image: ${image.prompt}`}>
        <img className="pv-generated-image" src={image.dataUrl} alt={image.prompt} />
      </div>
    </div>
  );
}

const btnPrimary = (disabled: boolean): React.CSSProperties => ({
  width: "100%", padding: "10px 14px", borderRadius: 10, border: "none", cursor: disabled ? "not-allowed" : "pointer",
  background: BRAND, color: "#fff", fontSize: 13, fontWeight: 600, opacity: disabled ? 0.5 : 1, transition: "opacity 160ms",
});
const roundBlueBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 20, border: "none", background: "var(--pv-blue)", display: "flex",
  alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "opacity 160ms ease",
};
const msgActionBtn: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 15, border: "none", background: "transparent", display: "flex",
  alignItems: "center", justifyContent: "center", cursor: "pointer",
};
const iconBtn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", fontSize: 12, color: MUTED, padding: 2 };
const skeleton = (h: number): React.CSSProperties => ({ height: h, borderRadius: 10, background: "var(--pv-hover)", marginBottom: 8, opacity: 0.6 });
