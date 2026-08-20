# Payvora F5-TTS Compatibility Adapter (Windows PC)

A separate service that sits NEXT TO your existing SkyrimNet adapter
(`f5_adapter_server.py`, port 7861). It does not touch that server — both run
at the same time and share the same F5-TTS installation and custom model.

```
Payvora Voice Studio
  → Payvora API server (Replit)
  → F5_TTS_SERVICE_URL (Cloudflare tunnel)
  → this adapter (port 7870, bearer auth)
  → F5-TTS Python API (f5_tts.api.F5TTS)
  → your CUDA GPU + model_212000.safetensors
  → real generated audio
```

## Why a separate service (not your 7861 adapter)

Your 7861 adapter's `/tts_to_audio` only accepts named speakers from
`voice_refs.json` — Payvora sends per-request reference audio for cloning.
It also returns silence WAV on failure (fine for SkyrimNet, but Payvora
requires honest errors), has no authentication, and no transcription
endpoint. This adapter provides all of that without changing SkyrimNet.

## Setup (once)

In the SAME Python environment where `f5_tts` is installed:

```bat
pip install fastapi uvicorn python-multipart requests
```

`ffmpeg` on PATH is optional but recommended — it enables real pitch/energy
DSP. Without it those controls are honestly rejected (speed still works,
it's native to F5-TTS).

Generate a token:

```bat
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Run

```bat
set F5_TTS_ADAPTER_TOKEN=<your token>
python adapter.py
```

Defaults match your installation (`C:\AI\F5-TTS\models\F5TTS_v1_Base_v4_winter\...`).
Override with `F5_TTS_CKPT_FILE` / `F5_TTS_VOCAB_FILE` / `F5_TTS_DEVICE` if needed.

## Test locally (before tunneling)

With the adapter running, in a second terminal:

```bat
set F5_TTS_ADAPTER_TOKEN=<same token>
set TEST_REFERENCE_WAV=C:\path\to\a\real\speech\sample.wav
python test_adapter.py
```

All tests must pass, and `payvora_test_output.wav` must contain real speech.

## Expose via Cloudflare tunnel

Download cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

```bat
cloudflared tunnel --url http://127.0.0.1:7870
```

Copy the printed `https://....trycloudflare.com` URL.

## Connect Payvora (Replit secrets)

- `F5_TTS_SERVICE_URL`   = the tunnel URL (no trailing slash)
- `F5_TTS_SERVICE_TOKEN` = the same value as `F5_TTS_ADAPTER_TOKEN`

The adapter refuses to start without a token and binds to 127.0.0.1 only —
it is never exposed unauthenticated.

## Honest capability map

| Payvora control | Status |
|---|---|
| speed | native F5-TTS inference parameter |
| pitch | real ffmpeg DSP (422 if ffmpeg missing) |
| energy | real ffmpeg DSP (422 if ffmpeg missing) |
| emotion / speaking style | unsupported — 422, F5-TTS mimics the reference only |
| vocal events ([laugh], …) | unsupported — 501, never faked |
| transcription | real, via F5-TTS's bundled Whisper |
| failures | HTTP errors; never silence/placeholder audio |
