"""
Payvora F5-TTS compatibility adapter (runs on YOUR Windows PC).

This is a SEPARATE service from your existing SkyrimNet adapter
(f5_adapter_server.py on port 7861). It does NOT modify, import, or replace
that server — both can run at the same time, sharing the same F5-TTS
installation and the same custom model checkpoint.

It exposes the exact /v1/* REST contract the Payvora API server expects and
calls the F5-TTS Python API directly (from f5_tts.api import F5TTS) — the
same API your existing adapter uses in f5_persistent mode.

Endpoints (all require `Authorization: Bearer <F5_TTS_ADAPTER_TOKEN>`):
  GET  /v1/health      -> JSON status: model loaded, CUDA, device, capabilities
  POST /v1/speech      -> real WAV bytes (multipart: text, reference_text,
                          reference_audio file, model, device, compute_type,
                          controls JSON, response_format)
  POST /v1/transcribe  -> {"text": "..."} via F5-TTS's bundled Whisper
  POST /v1/vocal-event -> 501 (F5-TTS cannot synthesize isolated vocal events)

Controls honesty:
  speed   -> native F5-TTS `speed` inference parameter (verified in api.py)
  pitch   -> real ffmpeg DSP (asetrate + atempo compensation); REJECTED with
             422 if ffmpeg is not installed — never silently ignored
  energy  -> real ffmpeg gain (volume filter); same ffmpeg requirement
  emotion -> REJECTED (422). F5-TTS mimics the reference recording's emotion;
             it has no emotion conditioning.
  unknown -> REJECTED (422). No control is ever silently dropped.

Failure honesty: inference errors, invalid reference audio, and missing output
produce HTTP errors. This adapter NEVER returns silence or placeholder audio.

Configuration (environment variables):
  F5_TTS_ADAPTER_TOKEN  REQUIRED. Long random bearer token; server refuses to
                        start without it.
  F5_TTS_CKPT_FILE      Path to your checkpoint. Default:
                        C:\\AI\\F5-TTS\\models\\F5TTS_v1_Base_v4_winter\\model_212000.safetensors
  F5_TTS_VOCAB_FILE     Path to your vocab. Default:
                        C:\\AI\\F5-TTS\\models\\F5TTS_v1_Base_v4_winter\\vocab.txt
  F5_TTS_MODEL          Model architecture name. Default: F5TTS_v1_Base
  F5_TTS_DEVICE         cuda / cpu / unset for auto-detect
  F5_TTS_ADAPTER_HOST   Default 127.0.0.1 (keep it; expose via tunnel only)
  F5_TTS_ADAPTER_PORT   Default 7870
  F5_TTS_NFE_STEP       Default 32 (matches your existing adapter)
  F5_TTS_CFG_STRENGTH   Default 2.0

Run (in the SAME Python environment where f5_tts is installed):
  pip install fastapi uvicorn python-multipart
  set F5_TTS_ADAPTER_TOKEN=<your token>
  python adapter.py
"""

from __future__ import annotations

import io
import json
import os
import secrets
import shutil
import subprocess
import tempfile
import threading
import wave

import uvicorn
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

ADAPTER_VERSION = "2.0.0"

HOST = os.environ.get("F5_TTS_ADAPTER_HOST", "127.0.0.1")
PORT = int(os.environ.get("F5_TTS_ADAPTER_PORT", "7870"))
TOKEN = os.environ.get("F5_TTS_ADAPTER_TOKEN", "")
MODEL_NAME = os.environ.get("F5_TTS_MODEL", "F5TTS_v1_Base")
DEVICE = os.environ.get("F5_TTS_DEVICE") or None  # None -> auto (cuda if available)
CKPT_FILE = os.environ.get(
    "F5_TTS_CKPT_FILE",
    r"C:\AI\F5-TTS\models\F5TTS_v1_Base_v4_winter\model_212000.safetensors",
)
VOCAB_FILE = os.environ.get(
    "F5_TTS_VOCAB_FILE",
    r"C:\AI\F5-TTS\models\F5TTS_v1_Base_v4_winter\vocab.txt",
)
NFE_STEP = int(os.environ.get("F5_TTS_NFE_STEP", "32"))
CFG_STRENGTH = float(os.environ.get("F5_TTS_CFG_STRENGTH", "2.0"))

if not TOKEN:
    raise SystemExit(
        "Refusing to start without authentication. Set F5_TTS_ADAPTER_TOKEN to a long "
        "random value, e.g.: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
    )
if not os.path.exists(CKPT_FILE):
    raise SystemExit(f"F5 model checkpoint not found: {CKPT_FILE} (set F5_TTS_CKPT_FILE)")
if not os.path.exists(VOCAB_FILE):
    raise SystemExit(f"F5 vocab file not found: {VOCAB_FILE} (set F5_TTS_VOCAB_FILE)")

FFMPEG = shutil.which("ffmpeg")

app = FastAPI(title="Payvora F5-TTS compatibility adapter", version=ADAPTER_VERSION)

# ── Load F5-TTS once at startup (direct Python API — same as your 7861 adapter
#    in f5_persistent mode; NOT the Gradio HTTP layer) ────────────────────────
print(f"[payvora-adapter] loading F5-TTS model={MODEL_NAME}")
print(f"[payvora-adapter] ckpt:  {CKPT_FILE}")
print(f"[payvora-adapter] vocab: {VOCAB_FILE}")
from f5_tts.api import F5TTS  # noqa: E402

TTS = F5TTS(model=MODEL_NAME, ckpt_file=CKPT_FILE, vocab_file=VOCAB_FILE, device=DEVICE)
INFER_LOCK = threading.Lock()  # serialize GPU inference, same as your existing adapter
print(f"[payvora-adapter] F5-TTS ready on device: {TTS.device}")


def _cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def check_auth(authorization: str | None) -> None:
    expected = f"Bearer {TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token.")


def validate_wav(data: bytes, what: str) -> None:
    """Reject non-WAV or insane audio instead of passing garbage to the model."""
    try:
        with wave.open(io.BytesIO(data), "rb") as w:
            frames, rate = w.getnframes(), w.getframerate()
    except Exception:
        raise HTTPException(status_code=422, detail=f"{what} is not a valid WAV file.")
    if rate < 8000 or rate > 96000 or frames <= 0:
        raise HTTPException(status_code=422, detail=f"{what} has an invalid sample rate or is empty.")


def output_wav_sane(path: str) -> tuple[bool, str]:
    """Same sanity rules your existing adapter applies to generated output."""
    try:
        with wave.open(path, "rb") as w:
            frames, rate = w.getnframes(), w.getframerate()
    except Exception as exc:
        return False, f"generated file is not readable WAV: {exc}"
    if rate <= 0 or frames <= 0:
        return False, "generated WAV is empty"
    duration = frames / float(rate)
    if duration < 0.05:
        return False, f"generated WAV is suspiciously short ({duration:.3f}s)"
    return True, ""


def run_ffmpeg(filters: str, input_bytes: bytes) -> bytes:
    proc = subprocess.run(
        [FFMPEG, "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-af", filters, "-f", "wav", "pipe:1"],
        input=input_bytes,
        capture_output=True,
    )
    if proc.returncode != 0 or not proc.stdout:
        raise HTTPException(
            status_code=500,
            detail=f"ffmpeg post-processing failed: {proc.stderr.decode(errors='replace')[:300]}",
        )
    return proc.stdout


def apply_dsp(wav_bytes: bytes, pitch_semitones: float, energy: float, sample_rate: int) -> bytes:
    """Real DSP. Neutral values are a no-op; non-neutral values REQUIRE ffmpeg."""
    filters = []
    if abs(pitch_semitones) > 0.01:
        ratio = 2 ** (pitch_semitones / 12)
        filters.append(
            f"asetrate={sample_rate}*{ratio:.6f},aresample={sample_rate},atempo={1 / ratio:.6f}"
        )
    if abs(energy - 1.0) > 0.01:
        filters.append(f"volume={energy:.4f}")
    if not filters:
        return wav_bytes
    if not FFMPEG:
        raise HTTPException(
            status_code=422,
            detail="pitch/energy adjustments require ffmpeg on the worker machine, and ffmpeg "
            "was not found. Install ffmpeg or use neutral values (pitch=0, energy=1).",
        )
    return run_ffmpeg(",".join(filters), wav_bytes)


ALLOWED_CONTROLS = {"speed", "pitch", "energy"}


def parse_controls(raw: str) -> tuple[float, float, float]:
    try:
        parsed = json.loads(raw or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=422, detail="controls must be valid JSON.")
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail="controls must be a JSON object.")
    if "emotion" in parsed:
        raise HTTPException(
            status_code=422,
            detail="Emotion control is not supported: F5-TTS has no emotion conditioning; "
            "it mimics the emotion of the reference recording only.",
        )
    unknown = set(parsed) - ALLOWED_CONTROLS
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported controls: {', '.join(sorted(unknown))}. "
            f"Supported: {', '.join(sorted(ALLOWED_CONTROLS))}.",
        )
    try:
        speed = float(parsed.get("speed", 1.0))
        pitch = float(parsed.get("pitch", 0.0))
        energy = float(parsed.get("energy", 1.0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="controls values must be numbers.")
    if not (0.5 <= speed <= 2.0):
        raise HTTPException(status_code=422, detail="speed must be between 0.5 and 2.0.")
    if not (-12.0 <= pitch <= 12.0):
        raise HTTPException(status_code=422, detail="pitch must be between -12 and 12 semitones.")
    if not (0.1 <= energy <= 3.0):
        raise HTTPException(status_code=422, detail="energy must be between 0.1 and 3.0.")
    return speed, pitch, energy


@app.get("/v1/health")
def health(authorization: str | None = Header(default=None)):
    check_auth(authorization)
    return {
        "status": "ok",
        "adapter": "payvora-f5tts-compat",
        "version": ADAPTER_VERSION,
        "engine": "f5-tts",
        "model": MODEL_NAME,
        "checkpoint_loaded": True,
        "device": str(TTS.device),
        "cuda_available": _cuda_available(),
        "auth": "bearer-token-required",
        "capabilities": {
            "speech": True,
            "transcribe": True,
            "vocal_events": False,
            "controls": {
                "speed": "native",
                "pitch": "ffmpeg-dsp" if FFMPEG else "unavailable (ffmpeg not installed)",
                "energy": "ffmpeg-dsp" if FFMPEG else "unavailable (ffmpeg not installed)",
                "emotion": "unsupported",
            },
        },
    }


@app.post("/v1/speech")
async def speech(
    text: str = Form(...),
    reference_text: str = Form(""),
    model: str = Form(""),          # accepted for contract compatibility; local model is used
    device: str = Form(""),         # accepted; device fixed at startup
    compute_type: str = Form(""),   # accepted; not applicable to this backend
    controls: str = Form("{}"),
    response_format: str = Form("wav"),
    reference_audio: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    check_auth(authorization)
    if not text.strip():
        raise HTTPException(status_code=422, detail="Text is required.")
    if response_format and response_format.lower() != "wav":
        raise HTTPException(status_code=422, detail="Only response_format=wav is supported.")
    speed, pitch, energy = parse_controls(controls)

    ref_bytes = await reference_audio.read()
    if not ref_bytes:
        raise HTTPException(status_code=422, detail="reference_audio is empty.")
    validate_wav(ref_bytes, "reference_audio")

    with tempfile.TemporaryDirectory(prefix="payvora_f5_") as tmp:
        ref_path = os.path.join(tmp, "reference.wav")
        out_path = os.path.join(tmp, "out.wav")
        with open(ref_path, "wb") as f:
            f.write(ref_bytes)
        try:
            with INFER_LOCK:
                TTS.infer(
                    ref_file=ref_path,
                    ref_text=reference_text or "",  # empty -> F5-TTS transcribes the reference
                    gen_text=text,
                    speed=speed,                    # native F5-TTS parameter
                    nfe_step=NFE_STEP,
                    cfg_strength=CFG_STRENGTH,
                    remove_silence=False,
                    file_wave=out_path,
                    progress=None,
                )
        except HTTPException:
            raise
        except Exception as error:  # real failure — surfaced, never faked
            raise HTTPException(status_code=500, detail=f"F5-TTS inference failed: {error}")
        if not os.path.exists(out_path):
            raise HTTPException(status_code=500, detail="F5-TTS finished but produced no output WAV.")
        ok, why = output_wav_sane(out_path)
        if not ok:
            raise HTTPException(status_code=500, detail=f"F5-TTS output rejected: {why}")
        with open(out_path, "rb") as f:
            wav_bytes = f.read()

    wav_bytes = apply_dsp(wav_bytes, pitch, energy, TTS.target_sample_rate)
    return Response(content=wav_bytes, media_type="audio/wav")


@app.post("/v1/vocal-event")
async def vocal_event(authorization: str | None = Header(default=None)):
    check_auth(authorization)
    return JSONResponse(
        status_code=501,
        content={
            "detail": "F5-TTS cannot synthesize isolated vocal events (laugh, sigh, ...). "
            "This is honestly unsupported — no substitute audio is generated."
        },
    )


@app.post("/v1/transcribe")
async def transcribe_endpoint(
    audio: UploadFile = File(...),
    authorization: str | None = Header(default=None),
):
    check_auth(authorization)
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=422, detail="audio is empty.")
    validate_wav(data, "audio")
    with tempfile.TemporaryDirectory(prefix="payvora_f5_") as tmp:
        path = os.path.join(tmp, "audio.wav")
        with open(path, "wb") as f:
            f.write(data)
        try:
            text = TTS.transcribe(path)  # F5-TTS's bundled Whisper ASR
        except Exception as error:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {error}")
    if not text or not text.strip():
        raise HTTPException(status_code=422, detail="No speech detected in the audio.")
    return {"text": text.strip()}


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT)
