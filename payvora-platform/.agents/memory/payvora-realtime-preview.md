---
name: Payvora realtime preview prerequisites
description: Infrastructure and proxy requirements for the honest composer voice path
---

The realtime composer must have a real server-side realtime provider configured before microphone audio can produce a transcript. The existing F5-TTS `/v1/transcribe` client is batch-only and is not a realtime WebSocket provider.

**Why:** The UI must never substitute loopback or batch transcription for the requested AudioWorklet/PCM16 realtime behavior; missing provider infrastructure must remain visible.

**How to apply:** Configure or implement the intended realtime provider server-side, keep credentials out of the browser, verify worker/provider reachability separately, and run the browser microphone acceptance check only after that is available. Replit preview routing must explicitly include realtime WebSocket paths.