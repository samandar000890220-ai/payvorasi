---
name: Payvora voice pipeline honesty
description: What the F5-TTS backend genuinely supports and which UI controls must stay unavailable
---
The rule: every Voice Studio control must map to a real F5-TTS worker parameter or a verified app-side transform; anything else is disabled with an honest tooltip.

**Why:** The user was emphatic — no fake data, no fake success, no controls that "work" only visually. Earlier assumptions modeled on ElevenLabs were explicitly rejected.

**How to apply:**
- Worker `/v1/speech` accepts `controls` JSON: speed (native), pitch & energy (real DSP in the worker adapter). `GET /api/voice/capabilities` is the source of truth; it also probes worker `GET /v1/health` and reports `configured`/`reachable`.
- Emotion (tags AND `settings.emotion` in any form, even empty/null) and vocal-event tags ([laugh], [sigh]…) are HONESTLY UNAVAILABLE → 422 with reason; registry keeps them with `supported:false` for future backends. Never silently strip, never fake.
- Tags are handled app-side: `[pause]`-family → ffmpeg silence concat; `[slowly]/[fast]` → ffmpeg time-stretch; `[emphasis]` → energy. Unknown tags → 422 before generation, never spoken aloud.
- The user's F5-TTS runs on their Windows PC (Gradio at 127.0.0.1:7860, NOT the REST contract). `f5tts-worker-adapter/adapter.py` (FastAPI, bearer-token required) translates /v1/* → direct F5-TTS Python API; exposed via cloudflared tunnel; URL/token live in F5_TTS_SERVICE_URL / F5_TTS_SERVICE_TOKEN secrets. All worker calls (incl. transcribe) must send the bearer header.
- Permanently unavailable (no backend support): Stability, Similarity, Role presets, Speaking Style, Clone-from-URL, share links, folders, "retrain".
- Never redesign existing pages; TextToSpeech.tsx IS the Voice Studio page — modify in place only.
- Generation records/audio scoped by signed session cookie ownerId; updateGenerationRecord takes optional ownerId for route-level writes.

**Reference length cap:** Payvora normalizes uploaded reference audio to ≤12 s (`-t 12` in validateAndNormalizeReference). **Why:** long references (a 200 s upload) push F5-TTS inference past the Cloudflare quick-tunnel ~100 s timeout → worker HTTP 502; F5-TTS also clones best from short refs. **How to apply:** keep the cap when touching reference normalization; if tunnel 502s reappear, compare inference duration vs tunnel timeout first.
