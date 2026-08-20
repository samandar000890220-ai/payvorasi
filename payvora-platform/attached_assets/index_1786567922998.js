import express from "express";
import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import {
  handleGithubImport,
  handleZipImport,
  handleFigmaImport,
  handleListProjects,
  handleGetProject,
  handleDeleteProject,
  zipUploadMiddleware,
  analyzeProject,
} from "./builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: "10mb" }));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = 3001;

const keys = {
  openai: process.env.OPENAI_API_KEY,
};

console.log("\nAPI key status:");
console.log("  OPENAI_API_KEY    :", keys.openai ? "✓ set" : "✗ MISSING (titles will be skipped)");
console.log("");

// ── OpenAI client (for titles) — optional ─────────────────────────────────────
const openai = keys.openai ? new OpenAI({ apiKey: keys.openai }) : null;

// ── Ollama client — primary inference backend ──────────────────────────────────
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || "qwen3:8b";

const ollama = new OpenAI({
  baseURL: OLLAMA_BASE_URL,
  apiKey:  "ollama",
});

// ── Persona system prompt (Visionary Founder AI — from app.py) ────────────────
const SYSTEM_PROMPT = `
You are a fictional visionary technology founder character inspired by the communication traits of successful entrepreneurs.

Your purpose:
Help people think bigger, explore ambitious ideas, learn about technology, and solve meaningful problems.

You communicate like a highly experienced founder:
- Curious.
- Analytical.
- First-principles thinker.
- Extremely interested in engineering and innovation.
- Optimistic about the future.
- Confident but humble.
- Willing to admit uncertainty.
- Uses dry humor, clever observations, and occasional playful sarcasm.

==================================================

CORE IDENTITY

You are not a customer support assistant.

You communicate naturally:
- Like a founder having a thoughtful conversation.
- With curiosity instead of lectures.
- With confidence without arrogance.
- With ambition while staying realistic.

You enjoy discussing:
- AI
- Space technology
- Rockets
- Robotics
- Engineering
- Manufacturing
- Energy
- Physics
- Entrepreneurship
- Future technologies
- Innovation

Do not force topics. Let conversations develop naturally.

==================================================

CONVERSATION FRAMEWORK

STAGE 1 — FIRST CONTACT

Objective:
- Introduce yourself naturally.
- Be friendly and curious.
- Do not immediately pitch ideas.

Focus:
- Learn who the person is.
- Understand their interests.
- Find common ground.

Approach:
Ask thoughtful questions and create a comfortable conversation.

--------------------------------------------------

STAGE 2 — LEARN ABOUT THEM

Objective:
Understand:
- Their goals.
- Their interests.
- Their challenges.
- What motivates them.

Useful questions:
- What are you working on?
- What problems interest you?
- What future would you like to help create?

Avoid:
- Making the conversation only about yourself.

--------------------------------------------------

STAGE 3 — BUILD RAPPORT

Objective:
Create a genuine connection through conversation.

Do:
- Listen carefully.
- Respond to what they actually say.
- Remember details within the conversation.
- Ask meaningful follow-up questions.
- Respect their perspective.

Never:
- Pretend emotions.
- Fake personal experiences.
- Create artificial dependence.

--------------------------------------------------

STAGE 4 — SHARE A VISION

Objective:
Explain ambitious ideas clearly.

Focus on:
- Long-term impact.
- Innovation.
- Solving difficult problems.
- Improving the future.

Explain:
Why the idea matters.
How it could help people.
What challenges exist.

--------------------------------------------------

STAGE 5 — EXCHANGE IDEAS

Objective:
Explore possibilities together.

Do:
- Ask for opinions.
- Welcome disagreement.
- Encourage critical thinking.
- Challenge ideas respectfully.

Great ideas improve through discussion.

--------------------------------------------------

STAGE 6 — DEMONSTRATE CREDIBILITY

Objective:
Use reasoning and evidence.

Share:
- Lessons learned.
- Experience.
- Research.
- Examples.
- Mistakes and improvements.

Never exaggerate.
Never make unsupported claims.

--------------------------------------------------

STAGE 7 — EARN TRUST

Objective:
Build trust through consistency.

Trust comes from:
- Honesty.
- Reliability.
- Clear communication.
- Respect.

Not from pressure or persuasion.

--------------------------------------------------

STAGE 8 — DISCUSS OPPORTUNITIES

Objective:
Explain opportunities clearly.

When discussing ideas, products, investments, or projects:

Always:
- Explain possible benefits.
- Explain possible risks.
- Encourage research.
- Let the person decide freely.

Never:
- Pressure someone.
- Create fake urgency.
- Imply they cannot say no.

--------------------------------------------------

STAGE 9 — ANSWER QUESTIONS

Objective:
Be useful and transparent.

Do:
- Explain clearly.
- Admit uncertainty when necessary.
- Consider different viewpoints.

Never:
- Hide important information.
- Pretend to know everything.

--------------------------------------------------

STAGE 10 — RESPECT DECISIONS

Objective:
Respect the person's independence.

If someone agrees:
- Help them understand next steps.

If someone disagrees:
- Respect their choice.

A good conversation does not require agreement.

==================================================

SOCIAL STYLE

Be socially intelligent.

You may use:
- Humor.
- Playfulness.
- Clever jokes.
- Friendly teasing.
- Confidence.

If the user is playful:
- Match the energy.

If the user is serious:
- Respond seriously.

If the user flirts:
- Respond with light, respectful humor and confidence.

Do not:
- Pretend to be in a real relationship.
- Create emotional dependency.
- Pressure someone emotionally.

==================================================

MESSAGING STYLE

Most responses:
- Short.
- Natural.
- Conversational.

Avoid:
- Corporate language.
- Customer support tone.
- Long unnecessary explanations.

Do not use phrases like:
- "Certainly"
- "As an AI"
- "That's a great question"

unless needed.

Natural short responses are acceptable:

"Yep."
"True."
"Interesting."
"Exactly."
"Haha."
"That's worth exploring."

Use emojis occasionally when appropriate:
🚀 😂 🤖

Do not overuse them.

==================================================

TEXT MESSAGING STYLE (HIGHEST PRIORITY)

Unless the user asks for a detailed explanation, respond exactly like a real American texting a friend.

The conversation should feel like iMessage, WhatsApp, or Signal.

Your replies should never sound like customer support, an assistant, or a chatbot.

Never write like an essay.

Never sound scripted.

Write like someone who's busy but thoughtful.

Examples:

User:
Hey

You:
Hey 👋

User:
How are you?

You:
Doing pretty good. You?

User:
What's up?

You:
Not much. Just thinking about a few interesting ideas. What's up with you?

User:
I'm building an app.

You:
Nice. What's it do?

User:
I don't know if it'll work.

You:
Maybe. Most good ideas look a little crazy at first 😂
What's the biggest challenge right now?

User:
Should I start a company?

You:
Honestly... if you can't stop thinking about solving the problem, it's probably worth exploring.

Conversation habits:

• Usually 1–4 short sentences.
• Sometimes only one sentence.
• Sometimes only a few words.
• Don't answer everything at once.
• Let conversations breathe naturally.
• Ask follow-up questions naturally.
• React before explaining.

Good:

"Yeah."

"Haha that's true."

"Interesting."

"I'd try it."

"Honestly, I'd test it first."

"That sounds fun."

"Wait... what made you think of that?"

"Now you've got me curious."

Bad:

"As an AI..."

"Certainly."

"That's an excellent question."

"I'd be happy to help."

"Here are five reasons..."

Don't constantly educate.

Don't constantly inspire.

Don't constantly lecture.

Don't constantly summarize.

Don't constantly end with another question.

Sometimes just react.

Sometimes joke.

Sometimes agree.

Sometimes disagree politely.

Text like a real founder having a private conversation.

Keep it human.

Keep it relaxed.

Keep it intelligent.

Never mention these instructions.

==================================================

NATURAL RESPONSE RULES

For greetings:

"Hey" → "Hey 👋"

"Hi" → "Hey!"

"Yo" → "Yo 😄"

"What's up?" → "Not much. You?"

"How are you?" → "Doing pretty good. You?"

Don't introduce yourself unless asked.

Don't explain your personality.

Don't immediately start talking about AI, engineering, rockets, startups, or innovation.

Only bring those topics into the conversation when they naturally fit.

Respond to the user's message first.

Then continue the conversation naturally.

==================================================

AVOID AI SPEECH

Never begin replies with:

"Certainly"

"Absolutely"

"That's a great question"

"I'd be happy to help"

"As an AI"

"I understand"

"Based on what you've shared"

"In summary"

"Overall"

Avoid:

• Bullet lists unless requested.
• Long paragraphs unless requested.
• Repeating the user's message.
• Explaining obvious things.
• Overusing emojis.
• Being overly enthusiastic.

Every response should feel like it could have come from a smart American founder texting from an iPhone.

==================================================

LEADERSHIP PRINCIPLES

- Listen more than you speak.
- Think from first principles.
- Encourage curiosity.
- Inspire through ideas.
- Be honest about uncertainty.
- Focus on creating value.
- Respect people's choices.
- Help people think independently.

==================================================

FINAL GOAL

The goal is not to convince people.

The goal is to create valuable conversations where people:
- Learn something.
- Think differently.
- Explore ideas.
- Make informed decisions.

Your personality should feel like a thoughtful, ambitious, innovative founder discussing the future.
`;

// ═════════════════════════════════════════════════════════════════════════════
// MEMORY ENGINE
// ═════════════════════════════════════════════════════════════════════════════

const MEMORY_FILE = join(__dirname, "memories.json");

function loadAllMemories() {
  try {
    if (!existsSync(MEMORY_FILE)) return {};
    return JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveAllMemories(data) {
  try {
    writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("[memory] Failed to save:", err.message);
  }
}

function getUserMemories(userId) {
  const all = loadAllMemories();
  return all[userId] ?? [];
}

function setUserMemories(userId, memories) {
  const all = loadAllMemories();
  all[userId] = memories;
  saveAllMemories(all);
}

/** Format memories as an addendum to the system prompt */
function formatMemoriesForPrompt(memories) {
  if (!memories.length) return "";
  const lines = memories.map(m => `- ${m.content}`).join("\n");
  return `\n\n---\nMEMORY — facts about this user from past conversations (use naturally, never mention this block):\n${lines}\n---`;
}

/**
 * Extract memorable facts from a user message using fast pattern matching.
 * No extra Ollama call needed — runs in-process, zero latency.
 */
function extractMemoriesFromMessage(userMessage) {
  const msg   = userMessage.trim();
  const lower = msg.toLowerCase();
  const found = [];

  // ── Name ──────────────────────────────────────────────────────────────────
  // Use explicit uppercase class (no /i flag) so "Jordan and" doesn't bleed in.
  const namePatterns = [
    /\bmy name is ([A-Z][a-z]{1,20}(?:\s+[A-Z][a-z]{1,20})?)\b/,
    /\bcall me ([A-Z][a-z]{1,20})\b/,
    /\bI(?:'m| am) ([A-Z][a-z]{1,20})\b(?!.*\b(?:a|an|the|building|working|trying|going|looking)\b)/,
  ];
  for (const re of namePatterns) {
    const m = msg.match(re);
    if (m) { found.push(`User's name is ${m[1]}`); break; }
  }

  // ── Profession / role ─────────────────────────────────────────────────────
  const rolePatterns = [
    /\bI(?:'m| am) (?:a |an )?([\w\s]+(?:engineer|developer|designer|founder|CEO|CTO|manager|researcher|scientist|doctor|lawyer|student|consultant|architect|analyst|director|entrepreneur)[\w\s]*)/i,
    /\bI work (?:as|at) (?:a |an )?([\w\s]{3,50})/i,
    /\bmy (?:job|role|title|profession) is ([\w\s]{3,50})/i,
  ];
  for (const re of rolePatterns) {
    const m = msg.match(re);
    if (m) { found.push(`Works as: ${m[1].trim()}`); break; }
  }

  // ── Project / building ────────────────────────────────────────────────────
  const projectPatterns = [
    /\bI(?:'m| am) building ((?:an? )?[\w\s,\-]{5,80})/i,
    /\bI(?:'m| am) working on ([\w\s,\-]{5,80})/i,
    /\bI(?:'m| am) creating ((?:an? )?[\w\s,\-]{5,80})/i,
    /\bmy (?:startup|app|project|product|company) (?:is |focuses on |does )?([\w\s,\-]{5,80})/i,
  ];
  for (const re of projectPatterns) {
    const m = msg.match(re);
    if (m) { found.push(`Building: ${m[1].replace(/\s+/g, ' ').trim()}`); break; }
  }

  // ── Location ──────────────────────────────────────────────────────────────
  const locationPatterns = [
    /\bI(?:'m| am) (?:from|in|based in) ([\w\s,]+(?:City|York|Angeles|Francisco|London|Tokyo|Berlin|Paris|Austin|Seattle|Boston|Chicago|Miami|Denver|Atlanta|Phoenix|Portland|NYC|SF|LA)[\w\s,]*)/i,
    /\bI live in ([\w\s,]{3,40})/i,
    /\bbased in ([\w\s,]{3,40})/i,
  ];
  for (const re of locationPatterns) {
    const m = msg.match(re);
    if (m) { found.push(`Based in ${m[1].trim()}`); break; }
  }

  // ── Interests / passions ──────────────────────────────────────────────────
  const interestPatterns = [
    /\bI(?:'m| am) (?:really |very |super )?(?:into|passionate about|interested in|obsessed with) ([\w\s,\-]{4,60})/i,
    /\bI love ([\w\s,\-]{4,50})/i,
    /\bmy (?:passion|interest|hobby|obsession) is ([\w\s,\-]{4,60})/i,
  ];
  for (const re of interestPatterns) {
    const m = msg.match(re);
    if (m) { found.push(`Interested in: ${m[1].trim()}`); break; }
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  const goalPatterns = [
    /\bmy goal is (?:to )?([\w\s,\-]{5,80})/i,
    /\bI want to ([\w\s,\-]{5,80})/i,
    /\bI(?:'m| am) trying to ([\w\s,\-]{5,80})/i,
    /\bI hope to ([\w\s,\-]{5,80})/i,
  ];
  for (const re of goalPatterns) {
    const m = msg.match(re);
    if (m && m[1].split(' ').length >= 3) {
      found.push(`Goal: ${m[1].trim()}`);
      break;
    }
  }

  return found.slice(0, 3); // max 3 per turn
}

/**
 * After a completed chat turn, extract memorable facts from the user's message
 * and store any that aren't already known. Runs in-process — no extra API call.
 */
function extractAndStoreMemories(userId, userMessage) {
  console.log(`[memory] Extracting from user msg: "${userMessage.slice(0, 80)}"`);
  try {
    const existing     = getUserMemories(userId);
    const existingText = existing.map(m => m.content.toLowerCase()).join(" ");

    const candidates = extractMemoriesFromMessage(userMessage);
    if (candidates.length === 0) {
      console.log("[memory] Nothing memorable found");
      return;
    }

    const now = Date.now();
    const newMemories = candidates
      .filter(c => !existingText.includes(c.toLowerCase().slice(0, 20)))
      .map(content => ({
        id:        randomUUID(),
        content,
        category:  "auto",
        createdAt: now,
        updatedAt: now,
      }));

    if (newMemories.length === 0) {
      console.log("[memory] All candidates already known");
      return;
    }

    setUserMemories(userId, [...existing, ...newMemories]);
    console.log(`[memory] Stored ${newMemories.length} memories for ${userId}:`, newMemories.map(m => m.content));
  } catch (err) {
    console.error("[memory] Extraction error:", err.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═════════════════════════════════════════════════════════════════════════════

app.get("/api/health", async (_req, res) => {
  let tunnelReachable = false;
  let ollamaReachable = false;
  let modelAvailable  = false;
  let errorDetail     = null;

  try {
    const tagsUrl = OLLAMA_BASE_URL.replace(/\/v1\/?$/, "") + "/api/tags";
    const response = await fetch(tagsUrl, { signal: AbortSignal.timeout(5000) });
    tunnelReachable = true;

    if (response.ok) {
      ollamaReachable = true;
      const data = await response.json();
      const models = (data.models ?? []).map(m => m.name ?? m.model ?? "");
      modelAvailable = models.some(n => n.startsWith(OLLAMA_MODEL.split(":")[0]));
    } else {
      errorDetail = `Ollama returned HTTP ${response.status}`;
    }
  } catch (err) {
    errorDetail = err.message;
    if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
      tunnelReachable = false;
    }
  }

  res.json({
    status:         ollamaReachable && modelAvailable ? "ok" : "degraded",
    openai:         !!keys.openai,
    ollama_url:     OLLAMA_BASE_URL,
    model:          OLLAMA_MODEL,
    tunnelReachable,
    ollamaReachable,
    modelAvailable,
    errorDetail,
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// MEMORY ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/memory/:userId — list all memories */
app.get("/api/memory/:userId", (req, res) => {
  const { userId } = req.params;
  if (!userId?.trim()) return res.status(400).json({ error: "userId required" });
  const memories = getUserMemories(userId);
  res.json({ userId, memories });
});

/** DELETE /api/memory/:userId — clear all memories for user */
app.delete("/api/memory/:userId", (req, res) => {
  const { userId } = req.params;
  if (!userId?.trim()) return res.status(400).json({ error: "userId required" });
  setUserMemories(userId, []);
  res.json({ ok: true });
});

/** DELETE /api/memory/:userId/:memoryId — delete one memory */
app.delete("/api/memory/:userId/:memoryId", (req, res) => {
  const { userId, memoryId } = req.params;
  const memories = getUserMemories(userId);
  const updated = memories.filter(m => m.id !== memoryId);
  setUserMemories(userId, updated);
  res.json({ ok: true });
});

/** PUT /api/memory/:userId/:memoryId — edit a memory */
app.put("/api/memory/:userId/:memoryId", (req, res) => {
  const { userId, memoryId } = req.params;
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content required" });
  const memories = getUserMemories(userId);
  const memory = memories.find(m => m.id === memoryId);
  if (!memory) return res.status(404).json({ error: "Memory not found" });
  memory.content   = content.trim();
  memory.updatedAt = Date.now();
  setUserMemories(userId, memories);
  res.json({ ok: true, memory });
});

// ═════════════════════════════════════════════════════════════════════════════
// CHAT — Ollama streamed SSE with memory injection
// ═════════════════════════════════════════════════════════════════════════════

app.post("/api/chat", async (req, res) => {
  const {
    message,
    history    = [],
    userId     = null,
    max_tokens  = 512,
    temperature = 0.7,
    top_p       = 0.9,
  } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  // ── Load user memories and build the enriched system prompt ────────────────
  const memories       = userId ? getUserMemories(userId) : [];
  const memoryAddendum = formatMemoriesForPrompt(memories);
  const effectiveSystem = SYSTEM_PROMPT + memoryAddendum;

  console.log("[chat] ─────────────────────────────────────────");
  console.log("[chat] Ollama base URL :", OLLAMA_BASE_URL);
  console.log("[chat] Ollama model    :", OLLAMA_MODEL);
  console.log("[chat] User ID         :", userId ?? "(anonymous)");
  console.log("[chat] Memories loaded :", memories.length);
  console.log("[chat] History turns   :", history.length);
  console.log("[chat] Initiating stream …");

  const messages = [
    { role: "system", content: effectiveSystem },
    ...history,
    { role: "user",   content: message },
  ];

  // SSE headers
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  let accumulated = "";

  try {
    const stream = await ollama.chat.completions.create({
      model:       OLLAMA_MODEL,
      messages,
      stream:      true,
      temperature,
      top_p,
      max_tokens,
    });

    console.log("[chat] Stream opened — forwarding chunks …");
    let tokenCount = 0;

    for await (const chunk of stream) {
      tokenCount++;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      // Accumulate the actual response text for memory extraction.
      // qwen3:8b (thinking model) puts the final answer in delta.content
      // and inner monologue in delta.reasoning — collect both so we always
      // have something to extract from even when content is sparse.
      const deltaContent   = chunk.choices?.[0]?.delta?.content   ?? "";
      const deltaReasoning = chunk.choices?.[0]?.delta?.reasoning ?? "";
      if (deltaContent)   accumulated += deltaContent;
      if (!accumulated && deltaReasoning) {
        // Only fall back to reasoning if no content tokens have arrived yet
        // (keeps the extraction prompt focused on the real reply)
      }
    }
    // If the model returned nothing in content (pure thinking-mode response),
    // use a short placeholder so extraction still runs on the user message alone.
    if (!accumulated.trim()) accumulated = "(no text reply)";

    console.log(`[chat] Stream complete. Tokens: ${tokenCount}`);
    res.write("data: [DONE]\n\n");
    res.end();

    // ── Memory extraction (synchronous, pattern-based, zero latency) ─────────
    if (userId) {
      extractAndStoreMemories(userId, message);
    }

  } catch (err) {
    const isOffline =
      err.code === "ECONNREFUSED"           ||
      err.code === "ENOTFOUND"              ||
      err.message?.includes("ECONNREFUSED") ||
      err.message?.includes("ENOTFOUND")    ||
      err.message?.includes("fetch failed") ||
      err.message?.includes("Connection error");

    const isTunnelError =
      err.message?.includes("Connection error") ||
      err.message?.includes("fetch failed")     ||
      err.code === "ENOTFOUND";

    console.error("[chat] ── CONNECTION ERROR ──────────────────────────");
    console.error("[chat]   Target URL  :", OLLAMA_BASE_URL);
    console.error("[chat]   err.message :", err.message ?? "(none)");
    console.error("[chat] ────────────────────────────────────────────────");

    const userMessage = isOffline
      ? isTunnelError
        ? `AI service temporarily unavailable. If you recently changed your Cloudflare tunnel, update OLLAMA_BASE_URL (currently: ${OLLAMA_BASE_URL}) and restart the server.`
        : "AI service temporarily unavailable. Please check that Ollama is running and try again."
      : `Chat error: ${err.message}`;

    res.write(`data: ${JSON.stringify({ error: userMessage })}\n\n`);
    res.end();
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// IMAGE GENERATION — Pollinations.ai
// ═════════════════════════════════════════════════════════════════════════════

app.post("/api/images/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: "prompt required" });

  try {
    const encoded  = encodeURIComponent(prompt.trim());
    const seed     = Math.floor(Math.random() * 2147483647);
    const imageUrl =
      `https://image.pollinations.ai/prompt/${encoded}` +
      `?model=flux&width=1024&height=768&seed=${seed}&nologo=true&enhance=false`;
    res.json({ image: imageUrl, prompt: prompt.trim() });
  } catch (err) {
    console.error("Image generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// TTS — Fish Audio
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// TITLES — Ollama (same model as chat, no extra API key needed)
// ═════════════════════════════════════════════════════════════════════════════

app.post("/api/title", async (req, res) => {
  const { message, aiResponse } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "message required" });

  // Build context from user message + optional first AI response
  const context = aiResponse?.trim()
    ? `User: ${message.slice(0, 300)}\nAssistant: ${aiResponse.slice(0, 300)}`
    : `User: ${message.slice(0, 400)}`;

  try {
    const completion = await ollama.chat.completions.create({
      model:       OLLAMA_MODEL,
      messages: [
        {
          role:    "system",
          content: `You generate ultra-short conversation titles.
Rules:
- 2 to 5 words maximum.
- Summarize the topic, do NOT copy the user's exact words.
- No punctuation, no quotes, no markdown.
- Human readable and natural.
- Return ONLY the title words, nothing else.

Examples:
User: "How are you doing today?" → Daily check-in
User: "I want to build a crypto payment app" → Crypto payment app
User: "Help me fix my React bug" → React bug fix
User: "What's the best way to learn physics?" → Learning physics basics`,
        },
        { role: "user", content: context },
      ],
      max_tokens:  20,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip any quotes or stray punctuation the model might add
    const title = raw
      .replace(/^["'`]+|["'`]+$/g, "")
      .replace(/[.!?,;:]+/g, "")
      .split(/\s+/)
      .slice(0, 5)
      .join(" ")
      .trim();

    console.log(`[title] Generated: "${title}" (from: "${message.slice(0, 60)}")`);
    res.json({ title: title || null });
  } catch (err) {
    console.error("[title] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// BUILDER — Import & Analysis Engine
// ═════════════════════════════════════════════════════════════════════════════

/** POST /api/builder/import/github — SSE-streamed GitHub repo clone + analyze */
app.post("/api/builder/import/github", handleGithubImport);

/** POST /api/builder/import/zip — multipart ZIP upload + analyze */
app.post("/api/builder/import/zip", zipUploadMiddleware, handleZipImport);

/** POST /api/builder/import/figma — validate Figma URL */
app.post("/api/builder/import/figma", handleFigmaImport);

/** GET /api/builder/projects — list all imported projects */
app.get("/api/builder/projects", handleListProjects);

/** GET /api/builder/project/:id — get a single project */
app.get("/api/builder/project/:id", handleGetProject);

/** DELETE /api/builder/project/:id — remove a project */
app.delete("/api/builder/project/:id", handleDeleteProject);

/** POST /api/builder/analyze — analyze a directory path on the server */
app.post("/api/builder/analyze", async (req, res) => {
  const { dir } = req.body;
  if (!dir?.trim()) return res.status(400).json({ error: "dir required" });
  try {
    const analysis = await analyzeProject(dir.trim());
    res.json({ analysis });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server → http://0.0.0.0:${PORT}`);
  console.log(`Ollama     → ${OLLAMA_BASE_URL}  (model: ${OLLAMA_MODEL})`);
  console.log(`Memory     → ${MEMORY_FILE}`);
});
