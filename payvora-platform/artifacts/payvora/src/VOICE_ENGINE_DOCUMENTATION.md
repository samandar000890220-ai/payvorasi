PAYVORA Voice Engine (client-side)

Overview

This repository addition provides a compact, UI-independent client-side voice engine hook and basic audio recording logic that integrates with the existing chat composer without creating any visual orb or replacing existing UI.

Files added

- src/voiceEngine.tsx — single-file, lightweight voice engine exposing useVoiceEngine() hook. It manages:
  - microphone permission requests
  - recording via MediaRecorder
  - sending recorded audio to a server-side transcription endpoint (/voice/transcribe)
  - simple state machine (idle, requesting_permission, recording, transcribing, interrupted, error)
  - interruption API (interruptAssistant)

Server-side contract

A server endpoint must exist to perform transcription and keep provider keys server-side. The client posts a FormData with key "file" to:

POST /voice/transcribe
  - Request: multipart/form-data with field "file" containing recorded audio (webm)
  - Response: JSON { "transcript": "transcribed text" }

This keeps API keys and provider credentials server-side and avoids exposing secrets in the browser.

How it integrates with the UI

- The chat composer (src/chat/ChatPanel.tsx) was NOT modified to change its appearance or Send button behavior. The Voice Engine is UI-independent and does NOT inject transcripts into the composer automatically.
- The Voice Engine exposes transcription and state via a typed hook (useVoiceEngine) so UI controllers or other components may consume the transcript and decide what to do with it.

Important usage note:
1. Do NOT modify the locked chat composer to add microphone controls. The composer must remain visually and behaviorally identical.
2. Do NOT reuse or repurpose the existing Send button — it must remain only a Send control.
3. To activate voice, consume the voice hook from an existing or future control outside the locked composer and call startRecording()/stopRecording(), then read transcript from the hook state.
Important design decisions / limitations

- This implementation intentionally uses a single-file client hook (voiceEngine.tsx) to make integration simple within the artifacts tree. The hook is UI-independent and can be refactored into a modular folder (src/voice/*) later.

- The client sends audio to /voice/transcribe. The transcription provider (OpenAI, Whisper, etc.) must be invoked from the server-side endpoint to keep credentials secret.

- This first pass focuses on dictation flow (record -> transcribe -> editable composer -> manual send). It does not implement realtime voice sessions or TTS playback streaming — those are planned next steps with provider abstractions (RealtimeVoiceProvider and TextToSpeechProvider).

- The AudioRecorder class is lightweight and intended for browser-compatible MediaRecorder usage. It handles track cleanup to avoid microphone leaks.

Future work

- Implement a server-side /voice/transcribe endpoint and connect a provider (Whisper/OpenAI/third-party). Avoid exposing API keys to the client.

- Expand provider abstractions (SpeechToTextProvider, RealtimeVoiceProvider, TextToSpeechProvider) and move implementations server-side or to a dedicated providers folder.

- Add tests for the voice state transitions (unit tests for the hook and recorder) and end-to-end tests for permission flow and transcription handling.

- Implement TTS playback manager and interruption handling integrated with assistant audio.

- Add accessible focus states and keyboard support for microphone controls (currently buttons are keyboard-focusable but can be improved).

"Future PAYVORA Voice Orb Integration"

The orb should consume the voice engine state (idle, listening, recording, transcribing, thinking, speaking, interrupted, error) through the useVoiceEngine hook. The orb must NOT implement microphone, STT, or TTS logic directly; it should only be a visual consumer of the state/events emitted by the voice engine.
