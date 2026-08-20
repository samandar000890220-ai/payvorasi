"""
Contract tests for the Payvora F5-TTS compatibility adapter.

Run ON YOUR WINDOWS PC while adapter.py is running:

  pip install requests
  set F5_TTS_ADAPTER_TOKEN=<same token as the adapter>
  python test_adapter.py

Optionally set ADAPTER_URL (default http://127.0.0.1:7870).

These tests exercise the real running adapter — they perform an ACTUAL
F5-TTS generation (test 6), so the model must be loaded and the machine
must have the reference audio produced by the test itself.
"""

from __future__ import annotations

import io
import math
import os
import struct
import sys
import wave

import requests

BASE = os.environ.get("ADAPTER_URL", "http://127.0.0.1:7870").rstrip("/")
TOKEN = os.environ.get("F5_TTS_ADAPTER_TOKEN", "")
if not TOKEN:
    sys.exit("Set F5_TTS_ADAPTER_TOKEN to the same token the adapter uses.")
AUTH = {"Authorization": f"Bearer {TOKEN}"}

PASS, FAIL = 0, 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def tone_wav(seconds: float = 3.0, freq: float = 220.0, rate: int = 24000) -> bytes:
    """A synthetic voiced-ish tone WAV. Valid audio container; not speech."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = bytearray()
        for i in range(int(seconds * rate)):
            v = int(12000 * math.sin(2 * math.pi * freq * i / rate))
            frames += struct.pack("<h", v)
        w.writeframes(bytes(frames))
    return buf.getvalue()


def is_wav(data: bytes) -> bool:
    return len(data) > 44 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"


def main() -> None:
    ref = None
    ref_path = os.environ.get("TEST_REFERENCE_WAV", "")
    if ref_path and os.path.exists(ref_path):
        ref = open(ref_path, "rb").read()
        print(f"Using real reference audio: {ref_path}")
    else:
        print("TIP: set TEST_REFERENCE_WAV to a real speech WAV for a genuine cloning test.")
        ref = tone_wav()

    print("\n1. Authentication")
    r = requests.get(f"{BASE}/v1/health", timeout=10)
    check("health without token -> 401", r.status_code == 401, f"got {r.status_code}")
    r = requests.get(f"{BASE}/v1/health", headers={"Authorization": "Bearer wrong"}, timeout=10)
    check("health with wrong token -> 401", r.status_code == 401, f"got {r.status_code}")

    print("\n2. Health")
    r = requests.get(f"{BASE}/v1/health", headers=AUTH, timeout=10)
    check("health with token -> 200", r.status_code == 200, f"got {r.status_code}")
    body = r.json() if r.status_code == 200 else {}
    check("health reports model", bool(body.get("model")))
    check("health does not leak token", TOKEN not in r.text)
    print(f"  device={body.get('device')} cuda={body.get('cuda_available')} "
          f"controls={body.get('capabilities', {}).get('controls')}")

    print("\n3. Speech validation errors")
    r = requests.post(f"{BASE}/v1/speech", headers=AUTH, timeout=30,
                      data={"text": "", "controls": "{}"},
                      files={"reference_audio": ("ref.wav", ref, "audio/wav")})
    check("empty text -> 422", r.status_code == 422, f"got {r.status_code}")
    r = requests.post(f"{BASE}/v1/speech", headers=AUTH, timeout=30,
                      data={"text": "Hello", "controls": "not json"},
                      files={"reference_audio": ("ref.wav", ref, "audio/wav")})
    check("bad controls JSON -> 422", r.status_code == 422, f"got {r.status_code}")
    r = requests.post(f"{BASE}/v1/speech", headers=AUTH, timeout=30,
                      data={"text": "Hello", "controls": '{"emotion":"sad"}'},
                      files={"reference_audio": ("ref.wav", ref, "audio/wav")})
    check("emotion control -> 422", r.status_code == 422, f"got {r.status_code}")
    r = requests.post(f"{BASE}/v1/speech", headers=AUTH, timeout=30,
                      data={"text": "Hello", "controls": '{"stability":0.5}'},
                      files={"reference_audio": ("ref.wav", ref, "audio/wav")})
    check("unknown control -> 422", r.status_code == 422, f"got {r.status_code}")
    r = requests.post(f"{BASE}/v1/speech", headers=AUTH, timeout=30,
                      data={"text": "Hello", "controls": "{}"},
                      files={"reference_audio": ("ref.wav", b"not audio", "audio/wav")})
    check("invalid reference audio -> 422", r.status_code == 422, f"got {r.status_code}")

    print("\n4. Vocal events honestly unsupported")
    r = requests.post(f"{BASE}/v1/vocal-event", headers=AUTH, timeout=10)
    check("vocal-event -> 501", r.status_code == 501, f"got {r.status_code}")

    print("\n5. Transcription")
    r = requests.post(f"{BASE}/v1/transcribe", headers=AUTH, timeout=120,
                      files={"audio": ("a.wav", ref, "audio/wav")})
    if ref_path:
        check("transcribe real speech -> 200 with text",
              r.status_code == 200 and bool(r.json().get("text")),
              f"got {r.status_code}: {r.text[:200]}")
    else:
        check("transcribe tone -> 200-with-text or honest 422",
              r.status_code in (200, 422), f"got {r.status_code}: {r.text[:200]}")

    print("\n6. REAL generation (this runs actual F5-TTS inference)")
    r = requests.post(f"{BASE}/v1/speech", headers=AUTH, timeout=600,
                      data={"text": "This is a real end to end generation test.",
                            "reference_text": "", "controls": '{"speed":1.0}',
                            "response_format": "wav"},
                      files={"reference_audio": ("ref.wav", ref, "audio/wav")})
    check("speech -> 200", r.status_code == 200, f"got {r.status_code}: {r.text[:300]}")
    if r.status_code == 200:
        check("response is real WAV bytes", is_wav(r.content), f"{len(r.content)} bytes")
        out = os.path.join(os.getcwd(), "payvora_test_output.wav")
        open(out, "wb").write(r.content)
        print(f"  saved: {out}  ({len(r.content)} bytes) — LISTEN to verify it is real speech")

        print("\n7. Pitch/energy DSP")
        r2 = requests.post(f"{BASE}/v1/speech", headers=AUTH, timeout=600,
                           data={"text": "Testing pitch and energy.", "controls": '{"pitch":3,"energy":1.5}'},
                           files={"reference_audio": ("ref.wav", ref, "audio/wav")})
        check("pitch+energy -> 200 (ffmpeg present) or 422 (honest)",
              r2.status_code in (200, 422), f"got {r2.status_code}: {r2.text[:200]}")

    print(f"\nRESULT: {PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
