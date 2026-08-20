# Memory Index

- [Payvora honesty contract](payvora-honesty.md) — every control functional or disabled+reason; billing internal-only (no payments); only gpt-5.6-terra connected; webhooks manual test delivery only.

- [Payvora voice pipeline honesty](payvora-voice-pipeline.md) — F5-TTS supports only speed/pitch/energy/emotion + tag registry; stability/similarity/role/share/folders must stay honestly unavailable.
- [Payvora ChatGPT-style shell](payvora-chatgpt-shell.md) — shell mimics ChatGPT iOS app (blue accent, pure white/black themes, theme vars only, muted+toast for unavailable controls).
- [Monorepo typecheck order](monorepo-typecheck.md) — run `pnpm exec tsc -b lib/db` before api-server typechecks; db package has no build script.
- [Payvora AI provider tests](payvora-ai-provider-tests.md) — keep provider loading lazy so canonical prompt tests run offline without an OpenAI integration.
- [Payvora clean preview setup](payvora-preview-setup.md) — imported checkouts need locked dependencies and a development schema before API-backed preview checks.
- [Payvora realtime preview prerequisites](payvora-realtime-preview.md) — composer realtime needs a real server provider; F5-TTS batch transcription is not a WebSocket provider.
