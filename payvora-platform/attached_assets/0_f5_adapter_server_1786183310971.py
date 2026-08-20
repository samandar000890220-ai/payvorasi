#!/usr/bin/env python3
"""
Standalone F5 adapter server for SkyrimNet.

This file does not import or modify the existing XTTS backend. It provides the
same basic API surface SkyrimNet expects. It can run in safe mock mode or call
real F5-TTS through the f5-tts_infer-cli command.
"""

import argparse
import html
import io
import json
import re
import shutil
import subprocess
import threading
import time
import wave
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel


HOST = "0.0.0.0"
PORT = 7861
BACKEND_NAME = "f5-adapter"
CURRENT_MODE = "mock"
OUTPUT_DIR = Path("output_temp") / "f5_generated"
VOICE_REFS_PATH = Path("voice_refs.json")
PRONUNCIATION_OVERRIDES_PATH = Path("pronunciation_overrides.json")
RUNTIME_SPEAKERS_DIR = Path("runtime_speakers")
ALLOW_RUNTIME_UPLOAD_OVERWRITE = False
PROJECT_ROOT = Path(__file__).resolve().parent
F5_CLI_NAME = "f5-tts_infer-cli"
F5_CLI_FALLBACK = Path(r"C:\Users\user\AppData\Local\Programs\Python\Python310\Scripts\f5-tts_infer-cli.EXE")
F5_MODEL_PATH = Path("models") / "F5TTS_v1_Base_v4_winter" / "model_212000.safetensors"
F5_VOCAB_PATH = Path("models") / "F5TTS_v1_Base_v4_winter" / "vocab.txt"
F5_INFERENCE_TIMEOUT_SECONDS = 600
F5_DEBUG_FAILED_DIR = Path("output_temp") / "f5_debug_failed"
F5_DEBUG_TEXT_DIR = Path("output_temp") / "f5_debug_text"
MAX_TEXT_CHARS = 0
APPEND_ENDING_PAUSE = True
ENDING_PAUSE_TEXT = "..."
MIN_OUTPUT_DURATION = 0.0
DEBUG_SAVE_TEXT = True
F5_SPEED = 1.0
F5_NFE_STEP = 32
F5_CFG_STRENGTH = 2.0
F5_SWAY_SAMPLING_COEF = -1.0
F5_CROSS_FADE_DURATION = 0.15
F5_FIX_DURATION_MODE = "none"
F5_DURATION_CPS = 10.0
F5_EXTRA_DURATION = 1.0
F5_REF_DURATION_FALLBACK = 0.0
F5_MAX_FIX_DURATION = 30.0
PERSISTENT_BACKEND = None
CLEANUP_ENABLED = True
CLEANUP_INTERVAL_MINUTES = 30.0
KEEP_OUTPUT_MINUTES = 60.0
CLEANUP_STOP_EVENT = threading.Event()
PRONUNCIATION_UI_ENABLED = True
PRONUNCIATION_REPLACEMENTS: Dict[str, str] = {}
PRONUNCIATION_LOCK = threading.Lock()
STRESS_MARK = "\u0301"
STRESS_VOWELS = set("аеёиоуыэюяАЕЁИОУЫЭЮЯ")


class TtsRequest(BaseModel):
    text: str = ""
    speaker_wav: Optional[str] = None
    language: Optional[str] = "ru"
    accent: Optional[str] = None
    save_path: Optional[str] = None
    override: Optional[bool] = False


class PronunciationSetRequest(BaseModel):
    source: str = ""
    replacement: str = ""


class PronunciationDeleteRequest(BaseModel):
    source: str = ""


app = FastAPI(
    title="SkyrimNet F5 Mock Adapter",
    description="Mock F5-TTS adapter that preserves SkyrimNet-compatible endpoints.",
    version="0.1.0",
)


def load_voice_refs() -> Dict[str, Dict[str, str]]:
    """Load F5 speaker references from voice_refs.json in the project root."""
    if not VOICE_REFS_PATH.exists():
        print(f"[{BACKEND_NAME}] WARNING: {VOICE_REFS_PATH} not found, using empty voice refs")
        return {}

    try:
        with VOICE_REFS_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except Exception as exc:
        print(f"[{BACKEND_NAME}] WARNING: failed to load {VOICE_REFS_PATH}: {exc}")
        return {}

    if not isinstance(data, dict):
        print(f"[{BACKEND_NAME}] WARNING: {VOICE_REFS_PATH} must contain a JSON object, using empty voice refs")
        return {}

    valid_refs: Dict[str, Dict[str, str]] = {}
    for key, value in data.items():
        if not isinstance(value, dict):
            print(f"[{BACKEND_NAME}] WARNING: voice ref '{key}' is not an object, skipping")
            continue

        ref_audio = value.get("ref_audio")
        ref_text = value.get("ref_text")
        if not isinstance(ref_audio, str) or not isinstance(ref_text, str):
            print(f"[{BACKEND_NAME}] WARNING: voice ref '{key}' must contain ref_audio and ref_text strings, skipping")
            continue

        valid_refs[key] = {"ref_audio": ref_audio, "ref_text": ref_text}

    print(f"[{BACKEND_NAME}] loaded voice refs: {len(valid_refs)} entries from {VOICE_REFS_PATH}")
    if "default" not in valid_refs:
        print(f"[{BACKEND_NAME}] WARNING: voice_refs.json has no 'default' fallback entry")
    return valid_refs


VOICE_REFS = load_voice_refs()


def _log(message: str) -> None:
    print(f"[{BACKEND_NAME}] {message}", flush=True)


def _empty_pronunciation_overrides() -> Dict[str, Dict[str, str]]:
    return {"replacements": {}}


def _load_pronunciation_overrides_from_disk() -> Dict[str, str]:
    if not PRONUNCIATION_OVERRIDES_PATH.exists():
        _log(
            f"WARNING: pronunciation overrides file not found: {PRONUNCIATION_OVERRIDES_PATH}; "
            "pronunciation overrides are empty"
        )
        return {}

    try:
        with PRONUNCIATION_OVERRIDES_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except Exception as exc:
        _log(f"WARNING: failed to load pronunciation overrides from {PRONUNCIATION_OVERRIDES_PATH}: {exc}")
        return {}

    if not isinstance(data, dict):
        _log(f"WARNING: {PRONUNCIATION_OVERRIDES_PATH} must contain a JSON object; using empty overrides")
        return {}

    replacements = data.get("replacements")
    if not isinstance(replacements, dict):
        _log(f"WARNING: {PRONUNCIATION_OVERRIDES_PATH} must contain a replacements object; using empty overrides")
        return {}

    valid_replacements: Dict[str, str] = {}
    for source, replacement in replacements.items():
        if not isinstance(source, str) or not isinstance(replacement, str):
            _log(f"WARNING: pronunciation override with non-string key/value skipped: {source!r}")
            continue
        if not source.strip() or not replacement.strip():
            _log(f"WARNING: pronunciation override with empty source/replacement skipped: {source!r}")
            continue
        valid_replacements[source] = replacement

    _log(f"pronunciation overrides loaded count: {len(valid_replacements)}")
    _log(f"pronunciation overrides file path: {PRONUNCIATION_OVERRIDES_PATH}")
    return valid_replacements


def _load_pronunciation_overrides() -> None:
    global PRONUNCIATION_REPLACEMENTS
    with PRONUNCIATION_LOCK:
        PRONUNCIATION_REPLACEMENTS = _load_pronunciation_overrides_from_disk()


def _save_pronunciation_overrides() -> None:
    data = _empty_pronunciation_overrides()
    data["replacements"] = dict(sorted(PRONUNCIATION_REPLACEMENTS.items(), key=lambda item: item[0].lower()))
    PRONUNCIATION_OVERRIDES_PATH.parent.mkdir(parents=True, exist_ok=True)
    with PRONUNCIATION_OVERRIDES_PATH.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _convert_plus_stress_format(text: str) -> tuple[str, list[str]]:
    if "+" not in text:
        return text, []

    converted: list[str] = []
    warnings: list[str] = []
    index = 0
    while index < len(text):
        char = text[index]
        if char != "+":
            converted.append(char)
            index += 1
            continue

        next_index = index + 1
        if next_index >= len(text):
            warnings.append("removed '+' at end of text")
            index += 1
            continue

        next_char = text[next_index]
        if next_char in STRESS_VOWELS:
            converted.append(next_char)
            if next_index + 1 >= len(text) or text[next_index + 1] != STRESS_MARK:
                converted.append(STRESS_MARK)
            index += 2
            continue

        warnings.append(f"removed '+' before non-vowel '{next_char}'")
        index += 1

    return "".join(converted), warnings


def _apply_pronunciation_overrides(text: str) -> tuple[str, bool, list[str]]:
    updated_text = _apply_pronunciation_replacements(text)
    converted_text, warnings = _convert_plus_stress_format(updated_text)
    return converted_text, converted_text != text, warnings


def _apply_pronunciation_replacements(text: str) -> str:
    with PRONUNCIATION_LOCK:
        replacements = dict(PRONUNCIATION_REPLACEMENTS)

    if not replacements:
        return text

    updated_text = text
    for source, replacement in sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True):
        pattern = re.compile(rf"(?<![\w]){re.escape(source)}(?![\w])", re.UNICODE)
        updated_text = pattern.sub(replacement, updated_text)
    return updated_text


def _is_localhost_request(request: Request) -> bool:
    if not request.client:
        return False
    return request.client.host in {"127.0.0.1", "::1", "localhost"}


def _require_pronunciation_ui(request: Request) -> None:
    if not PRONUNCIATION_UI_ENABLED:
        raise HTTPException(status_code=404, detail="Pronunciation UI is disabled")
    if not _is_localhost_request(request):
        raise HTTPException(status_code=403, detail="Pronunciation UI is only available from localhost")


def generate_silence_wav(duration_seconds: float = 1.0, sample_rate: int = 24000) -> bytes:
    """Create a valid mono 16-bit PCM silence WAV in memory."""
    frame_count = max(1, int(duration_seconds * sample_rate))
    silence_frames = b"\x00\x00" * frame_count

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(silence_frames)

    return buffer.getvalue()


def _safe_output_name(save_path: Optional[str]) -> str:
    if save_path:
        name = Path(save_path).name
        if name.lower().endswith(".wav"):
            return name
        return f"{name}.wav"

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    return f"f5_{CURRENT_MODE}_{timestamp}.wav"


def _write_silence_file(save_path: Optional[str]) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / _safe_output_name(save_path)
    output_path.write_bytes(generate_silence_wav())
    return output_path


def _cleanup_old_output_wavs_once() -> None:
    output_dir = OUTPUT_DIR.resolve()
    keep_seconds = max(0.0, KEEP_OUTPUT_MINUTES) * 60.0
    cutoff_time = time.time() - keep_seconds
    deleted_count = 0
    deleted_bytes = 0
    errors_count = 0

    _log("cleanup started")
    _log(f"cleanup output_dir: {output_dir}")
    _log(f"cleanup keep_output_minutes: {KEEP_OUTPUT_MINUTES}")

    if not output_dir.exists():
        _log("cleanup output_dir does not exist yet")
        _log("cleanup deleted files count: 0")
        _log("cleanup deleted bytes: 0")
        _log("cleanup errors count: 0")
        return

    if not output_dir.is_dir():
        _log("WARNING: cleanup output_dir is not a directory; skipping cleanup")
        _log("cleanup deleted files count: 0")
        _log("cleanup deleted bytes: 0")
        _log("cleanup errors count: 1")
        return

    for path in output_dir.iterdir():
        try:
            resolved_path = path.resolve()
            if resolved_path.parent != output_dir:
                continue
            if not path.is_file():
                continue
            if path.suffix.lower() != ".wav":
                continue
            stat = path.stat()
            if stat.st_mtime > cutoff_time:
                continue
            size = stat.st_size
            path.unlink()
            deleted_count += 1
            deleted_bytes += size
        except Exception as exc:
            errors_count += 1
            _log(f"WARNING: cleanup failed for {path}: {exc}")

    _log(f"cleanup deleted files count: {deleted_count}")
    _log(f"cleanup deleted bytes: {deleted_bytes}")
    _log(f"cleanup errors count: {errors_count}")


def _cleanup_loop() -> None:
    _cleanup_old_output_wavs_once()
    interval_seconds = max(0.1, CLEANUP_INTERVAL_MINUTES) * 60.0
    while not CLEANUP_STOP_EVENT.wait(interval_seconds):
        _cleanup_old_output_wavs_once()


def _start_cleanup_thread() -> threading.Thread:
    thread = threading.Thread(target=_cleanup_loop, name="f5-output-cleanup", daemon=True)
    thread.start()
    return thread


def _shorten_text_if_needed(text: str, max_chars: int) -> str:
    if max_chars <= 0 or len(text) <= max_chars:
        return text

    snippet = text[:max_chars]
    split_at = max(snippet.rfind("."), snippet.rfind(","), snippet.rfind(" "))
    if split_at > 0:
        shortened = snippet[: split_at + 1].strip()
    else:
        shortened = snippet.strip()
    if not shortened:
        shortened = snippet

    _log(
        f"WARNING: text was shortened from {len(text)} to {len(shortened)} chars "
        f"because --max-text-chars={max_chars}"
    )
    return shortened


def _prepare_f5_gen_text(text: str) -> tuple[str, bool]:
    gen_text = _shorten_text_if_needed(text, MAX_TEXT_CHARS)
    ending_pause_appended = False

    if APPEND_ENDING_PAUSE and ENDING_PAUSE_TEXT and not gen_text.rstrip().endswith("..."):
        gen_text = f"{gen_text.rstrip()} {ENDING_PAUSE_TEXT}"
        ending_pause_appended = True

    _log(f"original text: {text}")
    before_pronunciation = gen_text
    after_manual = _apply_pronunciation_replacements(before_pronunciation)
    gen_text, pronunciation_warnings = _convert_plus_stress_format(after_manual)
    pronunciation_changed = gen_text != before_pronunciation
    changed = gen_text != text

    _log(f"text after manual pronunciation overrides: {after_manual}")
    _log(f"pronunciation overrides changed: {str(pronunciation_changed).lower()}")
    for warning in pronunciation_warnings:
        _log(f"WARNING: plus stress conversion: {warning}")
    _log(f"f5 gen_text: {gen_text}")
    _log(f"f5 gen_text changed: {str(changed).lower()}")
    _log(f"was ending pause appended: {str(ending_pause_appended).lower()}")
    return gen_text, ending_pause_appended


def _resolve_path(path_text: str) -> Path:
    path = Path(path_text)
    if path.is_absolute():
        return path
    return PROJECT_ROOT / path


def _resolve_voice_ref(speaker_wav: Optional[str], gen_text: str) -> Optional[Dict[str, str]]:
    requested_key = speaker_wav or ""
    resolved_key = requested_key if requested_key in VOICE_REFS else "default"
    voice_ref = VOICE_REFS.get(resolved_key)

    print(f"[{BACKEND_NAME}] current mode: {CURRENT_MODE}")
    print(f"[{BACKEND_NAME}] requested speaker_wav: {requested_key}")
    print(f"[{BACKEND_NAME}] resolved speaker key: {resolved_key if voice_ref else None}")

    if not voice_ref:
        print(f"[{BACKEND_NAME}] ERROR: no voice ref for '{requested_key}' and no usable 'default'; returning silence WAV")
        print(f"[{BACKEND_NAME}] gen_text length: {len(gen_text)}")
        return None

    ref_audio = voice_ref["ref_audio"]
    ref_text = voice_ref["ref_text"]
    ref_audio_path = _resolve_path(ref_audio)
    ref_audio_exists = ref_audio_path.exists()

    print(f"[{BACKEND_NAME}] ref_audio: {ref_audio_path}")
    print(f"[{BACKEND_NAME}] ref_audio exists: {ref_audio_exists}")
    print(f"[{BACKEND_NAME}] ref_text preview: {ref_text[:80]}")
    print(f"[{BACKEND_NAME}] gen_text length: {len(gen_text)}")
    return {
        "speaker_key": resolved_key,
        "ref_audio": str(ref_audio_path),
        "ref_text": ref_text,
    }


def _find_f5_cli() -> Optional[str]:
    cli = shutil.which(F5_CLI_NAME)
    if cli:
        return cli
    if F5_CLI_FALLBACK.exists():
        return str(F5_CLI_FALLBACK)
    return None


def _read_wav_duration_info(output_path: Path) -> tuple[Optional[float], Optional[int]]:
    try:
        with wave.open(str(output_path), "rb") as wav_file:
            frame_count = wav_file.getnframes()
            frame_rate = wav_file.getframerate()
            if frame_rate <= 0:
                return None, frame_rate
            return frame_count / float(frame_rate), frame_rate
    except Exception as exc:
        _log(f"WARNING: failed to read WAV duration for {output_path}: {exc}")
        return None, None


def _is_sane_wav_duration(duration: Optional[float], sample_rate: Optional[int]) -> bool:
    if sample_rate is None or duration is None:
        return False
    return 8000 <= sample_rate <= 96000 and 0.1 < duration < 60.0


def _wav_duration_seconds(output_path: Path) -> Optional[float]:
    duration, sample_rate = _read_wav_duration_info(output_path)
    if not _is_sane_wav_duration(duration, sample_rate):
        _log(
            f"WARNING: invalid WAV duration for {output_path}: "
            f"duration={duration}, sample_rate={sample_rate}"
        )
        return None
    return duration


def _calculate_fix_duration(ref_audio: Path, gen_text: str) -> Optional[float]:
    if F5_FIX_DURATION_MODE != "auto":
        _log("--fix_duration skipped: f5_fix_duration_mode is none")
        return None

    raw_ref_audio_duration, sample_rate = _read_wav_duration_info(ref_audio)
    duration_valid = _is_sane_wav_duration(raw_ref_audio_duration, sample_rate)
    fallback_used = False

    _log(f"raw ref_audio_duration: {raw_ref_audio_duration}")
    _log(f"ref_audio sample_rate: {sample_rate}")
    _log(f"ref_audio_duration valid: {str(duration_valid).lower()}")

    if duration_valid:
        ref_audio_duration = raw_ref_audio_duration
    elif F5_REF_DURATION_FALLBACK > 0:
        ref_audio_duration = F5_REF_DURATION_FALLBACK
        fallback_used = True
        _log(f"WARNING: using --f5-ref-duration-fallback={F5_REF_DURATION_FALLBACK:.3f}")
    else:
        _log("WARNING: Invalid ref_audio_duration, disabling auto fix_duration for this request")
        _log("ref_audio_duration fallback used: false")
        _log("--fix_duration skipped")
        return None

    _log(f"ref_audio_duration fallback used: {str(fallback_used).lower()}")

    duration_cps = max(0.1, F5_DURATION_CPS)
    estimate_gen_duration = max(1.5, len(gen_text) / duration_cps + F5_EXTRA_DURATION)
    fix_duration = ref_audio_duration + estimate_gen_duration

    _log(f"ref_audio_duration: {ref_audio_duration:.3f}")
    _log(f"estimate_gen_duration: {estimate_gen_duration:.3f}")
    _log(f"fix_duration: {fix_duration:.3f}")
    if fix_duration > F5_MAX_FIX_DURATION:
        _log(
            f"WARNING: calculated fix_duration {fix_duration:.3f}s exceeds "
            f"--f5-max-fix-duration={F5_MAX_FIX_DURATION:.3f}s"
        )
        _log("--fix_duration skipped")
        return None

    _log("--fix_duration added")
    return fix_duration


def _tail(text: str, limit: int = 2000) -> str:
    return (text or "").strip()[-limit:]


def _write_failed_debug_json(
    output_path: Path,
    text: str,
    speaker_wav: Optional[str],
    voice_ref: Dict[str, str],
    output_duration: Optional[float],
    file_size: int,
    inference_time: float,
    stdout_tail: str,
    stderr_tail: str,
) -> Path:
    F5_DEBUG_FAILED_DIR.mkdir(parents=True, exist_ok=True)
    debug_path = F5_DEBUG_FAILED_DIR / f"{output_path.stem}.json"
    payload = {
        "text": text,
        "speaker_wav": speaker_wav,
        "resolved_speaker_key": voice_ref.get("speaker_key"),
        "ref_audio": voice_ref.get("ref_audio"),
        "ref_text": voice_ref.get("ref_text"),
        "output_path": str(output_path),
        "output_duration": output_duration,
        "file_size": file_size,
        "inference_time": inference_time,
        "stdout_tail": stdout_tail,
        "stderr_tail": stderr_tail,
    }
    with debug_path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return debug_path


def _save_debug_text(output_path: Path, gen_text: str) -> Optional[Path]:
    if not DEBUG_SAVE_TEXT:
        return None

    F5_DEBUG_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    text_path = F5_DEBUG_TEXT_DIR / f"{output_path.stem}.txt"
    with text_path.open("w", encoding="utf-8") as file:
        file.write(gen_text)
        file.write("\n")
    return text_path


def _diagnose_f5_output(
    output_path: Path,
    text: str,
    speaker_wav: Optional[str],
    voice_ref: Dict[str, str],
    inference_time: float,
    stdout_tail: str,
    stderr_tail: str,
) -> None:
    file_size = output_path.stat().st_size
    output_duration = _wav_duration_seconds(output_path)
    text_length = len(text)
    chars_per_second = text_length / output_duration if output_duration and output_duration > 0 else None

    _log(f"output file size bytes: {file_size}")
    if output_duration is None:
        _log("output duration seconds: unknown")
        _log(f"generated text length: {text_length}")
        _log("estimated chars per second: unknown")
        return

    _log(f"output duration seconds: {output_duration:.3f}")
    _log(f"generated text length: {text_length}")
    _log(f"estimated chars per second: {chars_per_second:.2f}")

    if MIN_OUTPUT_DURATION > 0 and output_duration < MIN_OUTPUT_DURATION:
        _log(
            f"WARNING: output WAV duration {output_duration:.3f}s is shorter than "
            f"--min-output-duration={MIN_OUTPUT_DURATION:.3f}s"
        )

    warnings = []
    if output_duration < 1.0 and text_length > 20:
        warnings.append("Suspiciously short output WAV")

    expected_min_duration = max(1.0, text_length / 25.0)
    if output_duration < expected_min_duration * 0.45:
        warnings.append("Possible truncated generation")

    for warning in warnings:
        _log(f"WARNING: {warning}")

    if warnings:
        debug_path = _write_failed_debug_json(
            output_path=output_path,
            text=text,
            speaker_wav=speaker_wav,
            voice_ref=voice_ref,
            output_duration=output_duration,
            file_size=file_size,
            inference_time=inference_time,
            stdout_tail=stdout_tail,
            stderr_tail=stderr_tail,
        )
        _log(f"debug JSON saved: {debug_path}")


class PersistentF5Backend:
    def __init__(self, model_path: Path, vocab_path: Path) -> None:
        self.model_path = model_path
        self.vocab_path = vocab_path
        self.lock = threading.Lock()

        if not model_path.exists():
            raise RuntimeError(f"F5 model checkpoint not found: {model_path}")
        if not vocab_path.exists():
            raise RuntimeError(f"F5 vocab not found: {vocab_path}")

        _log("f5_persistent model load start")
        _log(f"F5 model path: {model_path}")
        _log(f"F5 vocab path: {vocab_path}")
        started = time.perf_counter()
        try:
            from f5_tts.api import F5TTS
        except Exception as exc:
            raise RuntimeError(
                "F5TTS Python API import failed. Run this server with the Python "
                "environment where f5_tts is installed."
            ) from exc

        self.f5tts = F5TTS(
            model="F5TTS_v1_Base",
            ckpt_file=str(model_path),
            vocab_file=str(vocab_path),
        )
        elapsed = time.perf_counter() - started
        _log("f5_persistent model load end")
        _log(f"model load time: {elapsed:.2f}s")
        _log(f"device: {getattr(self.f5tts, 'device', '<unknown>')}")

    def infer(
        self,
        voice_ref: Dict[str, str],
        gen_text: str,
        output_path: Path,
        speaker_wav: Optional[str],
    ) -> Optional[Path]:
        ref_audio = Path(voice_ref["ref_audio"])
        ref_text = voice_ref["ref_text"]

        if not ref_audio.exists():
            _log(f"ERROR: ref_audio not found: {ref_audio}")
            return None
        if not ref_text.strip():
            _log("ERROR: ref_text is empty")
            return None

        output_path.parent.mkdir(parents=True, exist_ok=True)
        if output_path.exists():
            output_path.unlink(missing_ok=True)

        try:
            debug_text_path = _save_debug_text(output_path, gen_text)
            if debug_text_path:
                _log(f"debug F5 gen_text saved: {debug_text_path}")
        except Exception as exc:
            _log(f"WARNING: failed to save F5 gen_text debug file: {exc}")

        fix_duration = _calculate_fix_duration(ref_audio, gen_text)
        _log(f"f5_speed: {F5_SPEED}")
        _log(f"f5_nfe_step: {F5_NFE_STEP}")
        _log(f"f5_cfg_strength: {F5_CFG_STRENGTH}")
        _log(f"f5_sway_sampling_coef: {F5_SWAY_SAMPLING_COEF}")
        _log(f"f5_cross_fade_duration: {F5_CROSS_FADE_DURATION}")
        _log(f"f5_fix_duration_mode: {F5_FIX_DURATION_MODE}")
        _log(f"f5_duration_cps: {F5_DURATION_CPS}")
        _log(f"f5_extra_duration: {F5_EXTRA_DURATION}")
        _log(f"f5_ref_duration_fallback: {F5_REF_DURATION_FALLBACK}")
        _log(f"f5_max_fix_duration: {F5_MAX_FIX_DURATION}")
        if fix_duration is not None:
            _log(f"calculated fix_duration: {fix_duration:.3f}")

        _log("f5_persistent inference waiting for lock")
        started = time.perf_counter()
        wav = None
        try:
            with self.lock:
                _log("f5_persistent lock acquired")
                _log("f5_persistent inference start")
                _log(f"output path: {output_path}")
                wav, _sr, _spec = self.f5tts.infer(
                    ref_file=str(ref_audio),
                    ref_text=ref_text,
                    gen_text=gen_text,
                    speed=F5_SPEED,
                    nfe_step=F5_NFE_STEP,
                    cfg_strength=F5_CFG_STRENGTH,
                    sway_sampling_coef=F5_SWAY_SAMPLING_COEF,
                    cross_fade_duration=F5_CROSS_FADE_DURATION,
                    fix_duration=fix_duration,
                    file_wave=str(output_path),
                    progress=None,
                )
        except Exception as exc:
            elapsed = time.perf_counter() - started
            _log(f"inference time before failure: {elapsed:.2f}s")
            _log(f"ERROR: f5_persistent inference failed: {exc}")
            return None
        finally:
            _log("f5_persistent lock released")

        elapsed = time.perf_counter() - started
        _log("f5_persistent inference end")
        _log(f"inference time: {elapsed:.2f}s")

        if not output_path.exists() and wav is not None:
            _log("WARNING: F5 API returned wav but output file was not created; trying export_wav")
            try:
                self.f5tts.export_wav(wav, str(output_path), remove_silence=False)
            except Exception as exc:
                _log(f"ERROR: failed to save F5 API wav manually: {exc}")
                return None

        if not output_path.exists():
            _log(f"ERROR: f5_persistent finished but output WAV was not created: {output_path}")
            return None

        _log("success: f5_persistent output WAV created")
        try:
            _diagnose_f5_output(
                output_path=output_path,
                text=gen_text,
                speaker_wav=speaker_wav,
                voice_ref=voice_ref,
                inference_time=elapsed,
                stdout_tail="",
                stderr_tail="",
            )
        except Exception as exc:
            _log(f"WARNING: failed to write F5 output diagnostics: {exc}")
        return output_path


def _run_f5_inference(
    voice_ref: Dict[str, str],
    gen_text: str,
    output_path: Path,
    speaker_wav: Optional[str],
) -> Optional[Path]:
    cli = _find_f5_cli()
    if not cli:
        _log(f"ERROR: {F5_CLI_NAME} not found in PATH and fallback path does not exist")
        return None

    ref_audio = Path(voice_ref["ref_audio"])
    ref_text = voice_ref["ref_text"]

    if not ref_audio.exists():
        _log(f"ERROR: ref_audio not found: {ref_audio}")
        return None
    if not ref_text.strip():
        _log("ERROR: ref_text is empty")
        return None
    if not F5_MODEL_PATH.exists():
        _log(f"ERROR: F5 model checkpoint not found: {F5_MODEL_PATH}")
        return None
    if not F5_VOCAB_PATH.exists():
        _log(f"ERROR: F5 vocab not found: {F5_VOCAB_PATH}")
        return None

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink(missing_ok=True)

    try:
        debug_text_path = _save_debug_text(output_path, gen_text)
        if debug_text_path:
            _log(f"debug F5 gen_text saved: {debug_text_path}")
    except Exception as exc:
        _log(f"WARNING: failed to save F5 gen_text debug file: {exc}")

    fix_duration = _calculate_fix_duration(ref_audio, gen_text)
    _log(f"f5_speed: {F5_SPEED}")
    _log(f"f5_nfe_step: {F5_NFE_STEP}")
    _log(f"f5_cfg_strength: {F5_CFG_STRENGTH}")
    _log(f"f5_sway_sampling_coef: {F5_SWAY_SAMPLING_COEF}")
    _log(f"f5_cross_fade_duration: {F5_CROSS_FADE_DURATION}")
    _log(f"f5_fix_duration_mode: {F5_FIX_DURATION_MODE}")
    _log(f"f5_duration_cps: {F5_DURATION_CPS}")
    _log(f"f5_extra_duration: {F5_EXTRA_DURATION}")
    _log(f"f5_ref_duration_fallback: {F5_REF_DURATION_FALLBACK}")
    _log(f"f5_max_fix_duration: {F5_MAX_FIX_DURATION}")
    if fix_duration is not None:
        _log(f"calculated fix_duration: {fix_duration:.3f}")

    command = [
        cli,
        "--model",
        "F5TTS_v1_Base",
        "--ref_audio",
        str(ref_audio),
        "--ref_text",
        ref_text,
        "--gen_text",
        gen_text,
        "--speed",
        str(F5_SPEED),
        "--nfe_step",
        str(F5_NFE_STEP),
        "--cfg_strength",
        str(F5_CFG_STRENGTH),
        "--sway_sampling_coef",
        str(F5_SWAY_SAMPLING_COEF),
        "--cross_fade_duration",
        str(F5_CROSS_FADE_DURATION),
        "--ckpt_file",
        str(F5_MODEL_PATH),
        "--vocab_file",
        str(F5_VOCAB_PATH),
        "--output_dir",
        str(output_path.parent),
        "--output_file",
        output_path.name,
    ]
    if fix_duration is not None:
        command.extend(["--fix_duration", f"{fix_duration:.3f}"])

    _log(f"output path: {output_path}")
    _log(f"F5 command: {' '.join(command)}")
    _log("Running F5 inference. First run may take a long time...")
    started = time.perf_counter()
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=F5_INFERENCE_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        elapsed = time.perf_counter() - started
        _log(f"inference time before timeout: {elapsed:.2f}s")
        _log("ERROR: F5 inference timed out. Returning silence WAV.")
        if exc.stdout:
            stdout = exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else exc.stdout
            _log(f"stdout length before timeout: {len(stdout)}")
        if exc.stderr:
            stderr = exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, bytes) else exc.stderr
            _log(f"stderr length before timeout: {len(stderr)}")
        return None
    except Exception as exc:
        elapsed = time.perf_counter() - started
        _log(f"inference time before failure: {elapsed:.2f}s")
        _log(f"ERROR: failed to run F5 inference: {exc}")
        return None

    elapsed = time.perf_counter() - started
    stdout_tail = _tail(result.stdout)
    stderr_tail = _tail(result.stderr)
    _log(f"inference time: {elapsed:.2f}s")
    _log(f"stdout length: {len(result.stdout)}")
    _log(f"stderr length: {len(result.stderr)}")
    if stdout_tail:
        _log(f"stdout tail: {stdout_tail}")
    if stderr_tail:
        _log(f"stderr tail: {stderr_tail}")

    if result.returncode != 0:
        _log(f"ERROR: F5 command failed with exit code {result.returncode}")
        return None

    if not output_path.exists():
        _log(f"ERROR: F5 command finished but output WAV was not created: {output_path}")
        return None

    _log("success: F5 output WAV created")
    try:
        _diagnose_f5_output(
            output_path=output_path,
            text=gen_text,
            speaker_wav=speaker_wav,
            voice_ref=voice_ref,
            inference_time=elapsed,
            stdout_tail=stdout_tail,
            stderr_tail=stderr_tail,
        )
    except Exception as exc:
        _log(f"WARNING: failed to write F5 output diagnostics: {exc}")
    return output_path


def _safe_file_name(name: Optional[str], fallback: str) -> str:
    raw_name = Path(name or fallback).name
    safe_chars = []
    for char in raw_name:
        if char.isalnum() or char in ("-", "_", "."):
            safe_chars.append(char)
        else:
            safe_chars.append("_")
    safe_name = "".join(safe_chars).strip("._")
    return safe_name or fallback


async def _extract_fields_and_uploads(request: Request) -> tuple[Dict[str, Any], list[tuple[str, Any]]]:
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        try:
            data = await request.json()
            return (data if isinstance(data, dict) else {}), []
        except Exception as exc:
            print(f"[{BACKEND_NAME}] failed to parse JSON body: {exc}")
            return {}, []

    if "multipart/form-data" not in content_type and "application/x-www-form-urlencoded" not in content_type:
        return {}, []

    try:
        form = await request.form()
    except Exception as exc:
        print(f"[{BACKEND_NAME}] failed to parse form body: {exc}")
        return {}, []

    fields: Dict[str, Any] = {}
    uploads = []
    for key, value in form.multi_items():
        if hasattr(value, "filename") and hasattr(value, "read"):
            fields[key] = getattr(value, "filename", None)
            uploads.append((key, value))
        else:
            fields[key] = value

    return fields, uploads


async def _extract_fields_and_save_runtime_uploads(request: Request) -> tuple[Dict[str, Any], list[str]]:
    fields, uploads = await _extract_fields_and_uploads(request)
    saved_files: list[str] = []
    if not uploads:
        return fields, saved_files

    _log(
        "WARNING: Received SkyrimNet voice sample upload. It will not update F5 voice_refs "
        "because F5 also needs matching ref_text."
    )

    speaker = fields.get("speaker") or fields.get("speaker_name") or fields.get("speaker_wav")
    for key, upload in uploads:
        upload_name = getattr(upload, "filename", None)
        if speaker:
            target_name = _safe_file_name(f"{Path(str(speaker)).stem}.wav", f"{key}.wav")
        else:
            target_name = _safe_file_name(upload_name, f"{key}.wav")

        target_path = RUNTIME_SPEAKERS_DIR / target_name
        try:
            RUNTIME_SPEAKERS_DIR.mkdir(parents=True, exist_ok=True)
            if target_path.exists() and not ALLOW_RUNTIME_UPLOAD_OVERWRITE:
                _log(f"runtime voice sample already exists, keeping existing file: {target_path}")
                continue
            content = await upload.read()
            target_path.write_bytes(content)
            saved_files.append(str(target_path))
            _log(f"saved uploaded runtime voice sample: {target_path}")
        except Exception as exc:
            _log(f"failed to save uploaded runtime voice sample '{upload_name}': {exc}")

    return fields, saved_files


async def _extract_request_fields(request: Request) -> Dict[str, Any]:
    fields, _ = await _extract_fields_and_uploads(request)
    return fields


@app.get("/pronunciation", response_class=HTMLResponse)
async def pronunciation_page(request: Request) -> HTMLResponse:
    _require_pronunciation_ui(request)
    with PRONUNCIATION_LOCK:
        replacements = dict(sorted(PRONUNCIATION_REPLACEMENTS.items(), key=lambda item: item[0].lower()))

    rows = []
    for source, replacement in replacements.items():
        rows.append(
            "<tr>"
            f"<td>{html.escape(source)}</td>"
            f"<td>{html.escape(replacement)}</td>"
            "<td>"
            f"<button type=\"button\" data-source=\"{html.escape(source, quote=True)}\" class=\"delete-button\">Delete</button>"
            "</td>"
            "</tr>"
        )
    rows_html = "\n".join(rows) if rows else "<tr><td colspan=\"3\" class=\"empty\">No pronunciation overrides yet.</td></tr>"
    file_path = html.escape(str(PRONUNCIATION_OVERRIDES_PATH))
    count = len(replacements)

    page = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pronunciation Overrides</title>
  <style>
    :root {{ color-scheme: light dark; font-family: Arial, sans-serif; }}
    body {{ margin: 0; padding: 24px; background: #f5f5f2; color: #202124; }}
    main {{ max-width: 920px; margin: 0 auto; }}
    h1 {{ margin: 0 0 16px; font-size: 28px; }}
    .meta, .hint, .message {{ margin: 8px 0; color: #4f5458; }}
    table {{ width: 100%; border-collapse: collapse; margin: 18px 0; background: #ffffff; }}
    th, td {{ border: 1px solid #d8d8d2; padding: 10px; text-align: left; vertical-align: top; }}
    th {{ background: #ecece6; }}
    .empty {{ text-align: center; color: #6b6f74; }}
    form {{ display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; margin-top: 18px; }}
    label {{ display: grid; gap: 5px; font-size: 13px; color: #3e4347; }}
    input {{ font-size: 16px; padding: 8px; border: 1px solid #b7b9b1; border-radius: 4px; }}
    button {{ padding: 9px 12px; border: 1px solid #7e858a; border-radius: 4px; background: #ffffff; color: #202124; cursor: pointer; }}
    button:hover {{ background: #ecece6; }}
    .actions {{ margin-top: 12px; }}
    @media (max-width: 720px) {{
      body {{ padding: 14px; }}
      form {{ grid-template-columns: 1fr; }}
      table {{ font-size: 14px; }}
    }}
    @media (prefers-color-scheme: dark) {{
      body {{ background: #191b1d; color: #f1f1ed; }}
      table {{ background: #24272a; }}
      th, td {{ border-color: #454a4f; }}
      th {{ background: #303438; }}
      input, button {{ background: #202326; color: #f1f1ed; border-color: #646a70; }}
      button:hover {{ background: #303438; }}
      .meta, .hint, .message, label, .empty {{ color: #c2c6c9; }}
    }}
  </style>
</head>
<body>
<main>
  <h1>Pronunciation Overrides</h1>
  <div class="meta">File: <code>{file_path}</code></div>
  <div class="meta">Entries: <strong id="entry-count">{count}</strong></div>
  <div class="hint">Use + before stressed vowel. Example: Вайтр+ан -> Вайтра́н.</div>
  <table>
    <thead><tr><th>Source word</th><th>Replacement</th><th>Action</th></tr></thead>
    <tbody>{rows_html}</tbody>
  </table>
  <form id="set-form">
    <label>Source word<input name="source" autocomplete="off" required></label>
    <label>Replacement<input name="replacement" autocomplete="off" required></label>
    <button type="submit">Save</button>
  </form>
  <div class="actions"><button type="button" id="reload-button">Reload from file</button></div>
  <div class="message" id="message"></div>
</main>
<script>
const message = document.getElementById('message');
async function postJson(url, payload) {{
  const response = await fetch(url, {{
    method: 'POST',
    headers: {{'Content-Type': 'application/json'}},
    body: JSON.stringify(payload || {{}})
  }});
  const data = await response.json();
  if (!response.ok || data.success === false) {{
    throw new Error(data.detail || data.error || 'Request failed');
  }}
  return data;
}}
document.getElementById('set-form').addEventListener('submit', async (event) => {{
  event.preventDefault();
  const form = event.currentTarget;
  try {{
    await postJson('/pronunciation/api/set', {{
      source: form.source.value,
      replacement: form.replacement.value
    }});
    location.reload();
  }} catch (error) {{
    message.textContent = error.message;
  }}
}});
document.querySelectorAll('.delete-button').forEach((button) => {{
  button.addEventListener('click', async () => {{
    try {{
      await postJson('/pronunciation/api/delete', {{source: button.dataset.source}});
      location.reload();
    }} catch (error) {{
      message.textContent = error.message;
    }}
  }});
}});
document.getElementById('reload-button').addEventListener('click', async () => {{
  try {{
    await postJson('/pronunciation/api/reload', {{}});
    location.reload();
  }} catch (error) {{
    message.textContent = error.message;
  }}
}});
</script>
</body>
</html>"""
    return HTMLResponse(page)


@app.get("/pronunciation/api/list")
async def pronunciation_api_list(request: Request) -> Dict[str, Any]:
    _require_pronunciation_ui(request)
    with PRONUNCIATION_LOCK:
        replacements = dict(sorted(PRONUNCIATION_REPLACEMENTS.items(), key=lambda item: item[0].lower()))
    return {
        "replacements": replacements,
        "count": len(replacements),
        "file_path": str(PRONUNCIATION_OVERRIDES_PATH),
    }


@app.post("/pronunciation/api/set")
async def pronunciation_api_set(request: Request, payload: PronunciationSetRequest) -> Dict[str, Any]:
    _require_pronunciation_ui(request)
    source = payload.source.strip()
    replacement = payload.replacement.strip()
    if not source:
        raise HTTPException(status_code=400, detail="source must not be empty")
    if not replacement:
        raise HTTPException(status_code=400, detail="replacement must not be empty")

    with PRONUNCIATION_LOCK:
        PRONUNCIATION_REPLACEMENTS[source] = replacement
        _save_pronunciation_overrides()
        count = len(PRONUNCIATION_REPLACEMENTS)
    _log(f"pronunciation replacement added/updated: {source} -> {replacement}")
    return {"success": True, "replacements": {source: replacement}, "count": count}


@app.post("/pronunciation/api/delete")
async def pronunciation_api_delete(request: Request, payload: PronunciationDeleteRequest) -> Dict[str, Any]:
    _require_pronunciation_ui(request)
    source = payload.source.strip()
    if not source:
        raise HTTPException(status_code=400, detail="source must not be empty")

    with PRONUNCIATION_LOCK:
        existed = source in PRONUNCIATION_REPLACEMENTS
        PRONUNCIATION_REPLACEMENTS.pop(source, None)
        _save_pronunciation_overrides()
        count = len(PRONUNCIATION_REPLACEMENTS)
    _log(f"pronunciation replacement deleted: {source} existed={str(existed).lower()}")
    return {"success": True, "deleted": source, "existed": existed, "count": count}


@app.post("/pronunciation/api/reload")
async def pronunciation_api_reload(request: Request) -> Dict[str, Any]:
    _require_pronunciation_ui(request)
    _load_pronunciation_overrides()
    with PRONUNCIATION_LOCK:
        count = len(PRONUNCIATION_REPLACEMENTS)
    return {"success": True, "count": count, "file_path": str(PRONUNCIATION_OVERRIDES_PATH)}


@app.get("/health")
async def health() -> Dict[str, str]:
    print(f"[{BACKEND_NAME}] /health called")
    return {"status": "ok", "backend": f"f5-{CURRENT_MODE}"}


@app.post("/tts_to_audio")
@app.post("/tts_to_audio/")
async def tts_to_audio(payload: TtsRequest) -> FileResponse:
    print(f"[{BACKEND_NAME}] endpoint called: /tts_to_audio")
    print(f"[{BACKEND_NAME}] current mode: {CURRENT_MODE}")
    print(f"[{BACKEND_NAME}] received text: {payload.text}")
    print(f"[{BACKEND_NAME}] speaker_wav: {payload.speaker_wav}")
    print(f"[{BACKEND_NAME}] language: {payload.language}")
    print(f"[{BACKEND_NAME}] save_path: {payload.save_path}")
    output_path = OUTPUT_DIR / _safe_output_name(payload.save_path)

    if payload.text == "ping":
        print(f"[{BACKEND_NAME}] ping received, returning silence WAV")
        output_path = _write_silence_file(payload.save_path)
    else:
        gen_text, _ending_pause_appended = _prepare_f5_gen_text(payload.text)
        voice_ref = _resolve_voice_ref(payload.speaker_wav, gen_text)
        if CURRENT_MODE == "f5":
            if voice_ref:
                generated_path = _run_f5_inference(voice_ref, gen_text, output_path, payload.speaker_wav)
                if generated_path:
                    output_path = generated_path
                else:
                    print(f"[{BACKEND_NAME}] failure: returning silence WAV fallback")
                    output_path = _write_silence_file(payload.save_path)
            else:
                print(f"[{BACKEND_NAME}] failure: missing voice ref, returning silence WAV fallback")
                output_path = _write_silence_file(payload.save_path)
        elif CURRENT_MODE == "f5_persistent":
            if voice_ref and PERSISTENT_BACKEND:
                generated_path = PERSISTENT_BACKEND.infer(voice_ref, gen_text, output_path, payload.speaker_wav)
                if generated_path:
                    output_path = generated_path
                else:
                    print(f"[{BACKEND_NAME}] failure: returning silence WAV fallback")
                    output_path = _write_silence_file(payload.save_path)
            elif voice_ref:
                print(f"[{BACKEND_NAME}] failure: persistent backend is not loaded, returning silence WAV fallback")
                output_path = _write_silence_file(payload.save_path)
            else:
                print(f"[{BACKEND_NAME}] failure: missing voice ref, returning silence WAV fallback")
                output_path = _write_silence_file(payload.save_path)
        else:
            print(f"[{BACKEND_NAME}] mock generation, returning silence WAV")
            output_path = _write_silence_file(payload.save_path)

    print(f"[{BACKEND_NAME}] output path: {output_path}")

    return FileResponse(
        path=str(output_path),
        media_type="audio/wav",
        filename=output_path.name,
    )


@app.post("/create_and_store_latents")
@app.post("/create_and_store_latents/")
async def create_and_store_latents(request: Request) -> JSONResponse:
    fields, saved_files = await _extract_fields_and_save_runtime_uploads(request)

    print(f"[{BACKEND_NAME}] endpoint called: /create_and_store_latents")
    print(f"[{BACKEND_NAME}] speaker: {fields.get('speaker') or fields.get('speaker_name')}")
    print(f"[{BACKEND_NAME}] language: {fields.get('language')}")
    print(f"[{BACKEND_NAME}] file: {fields.get('file') or fields.get('wav_file')}")
    print(f"[{BACKEND_NAME}] speaker_wav: {fields.get('speaker_wav')}")
    print(f"[{BACKEND_NAME}] uploaded sample saved: {bool(saved_files)}")
    print(f"[{BACKEND_NAME}] F5 mock no-op, no latents are created")

    return JSONResponse(
        {
            "success": True,
            "backend": BACKEND_NAME,
            "message": "F5 mock no-op: create_and_store_latents accepted.",
            "received": {
                "speaker": fields.get("speaker") or fields.get("speaker_name"),
                "language": fields.get("language"),
                "file": fields.get("file") or fields.get("wav_file"),
                "speaker_wav": fields.get("speaker_wav"),
                "saved_files": saved_files,
            },
        }
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Standalone SkyrimNet F5 adapter server")
    parser.add_argument(
        "--mode",
        choices=["mock", "f5", "f5_persistent"],
        default="mock",
        help="Adapter mode. Default: mock",
    )
    parser.add_argument("--host", default=HOST, help=f"Host to bind. Default: {HOST}")
    parser.add_argument("--port", type=int, default=PORT, help=f"Port to bind. Default: {PORT}")
    parser.add_argument(
        "--output-dir",
        default=str(OUTPUT_DIR),
        help=f"Directory for temporary generated WAV files. Default: {OUTPUT_DIR}",
    )
    parser.add_argument(
        "--cleanup-enabled",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Enable periodic cleanup of old generated WAV files. Default: true",
    )
    parser.add_argument(
        "--cleanup-interval-minutes",
        type=float,
        default=30.0,
        help="Minutes between generated WAV cleanup passes. Default: 30",
    )
    parser.add_argument(
        "--keep-output-minutes",
        type=float,
        default=60.0,
        help="Keep generated WAV files at least this many minutes. Default: 60",
    )
    parser.add_argument(
        "--max-text-chars",
        type=int,
        default=0,
        help="Maximum text length for F5 generation. 0 means no limit. Default: 0",
    )
    parser.add_argument(
        "--append-ending-pause",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Append ending pause text before F5 generation. Default: true",
    )
    parser.add_argument(
        "--ending-pause-text",
        default="...",
        help='Text appended when --append-ending-pause is enabled. Default: "..."',
    )
    parser.add_argument(
        "--min-output-duration",
        type=float,
        default=0.0,
        help="Warn when generated WAV is shorter than this many seconds. 0 disables. Default: 0",
    )
    parser.add_argument(
        "--debug-save-text",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Save text sent to F5 under output_temp/f5_debug_text. Default: true",
    )
    parser.add_argument(
        "--pronunciation-overrides",
        default=str(PRONUNCIATION_OVERRIDES_PATH),
        help=f"Path to pronunciation overrides JSON. Default: {PRONUNCIATION_OVERRIDES_PATH}",
    )
    parser.add_argument(
        "--pronunciation-ui-enabled",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Enable localhost-only pronunciation overrides UI and API. Default: true",
    )
    parser.add_argument(
        "--runtime-speakers-dir",
        default=str(RUNTIME_SPEAKERS_DIR),
        help=f"Directory for SkyrimNet Select/runtime uploaded speaker WAV files. Default: {RUNTIME_SPEAKERS_DIR}",
    )
    parser.add_argument(
        "--allow-runtime-upload-overwrite",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Allow /create_and_store_latents uploads to overwrite files in runtime-speakers-dir. Default: false",
    )
    parser.add_argument(
        "--f5-model-path",
        default=str(F5_MODEL_PATH),
        help=f"F5 model checkpoint path. Default: {F5_MODEL_PATH}",
    )
    parser.add_argument(
        "--f5-vocab-path",
        default=str(F5_VOCAB_PATH),
        help=f"F5 vocab path. Default: {F5_VOCAB_PATH}",
    )
    parser.add_argument("--f5-speed", type=float, default=1.0, help="F5 CLI --speed value. Default: 1.0")
    parser.add_argument("--f5-nfe-step", type=int, default=32, help="F5 CLI --nfe_step value. Default: 32")
    parser.add_argument("--f5-cfg-strength", type=float, default=2.0, help="F5 CLI --cfg_strength value. Default: 2.0")
    parser.add_argument(
        "--f5-sway-sampling-coef",
        type=float,
        default=-1.0,
        help="F5 CLI --sway_sampling_coef value. Default: -1.0",
    )
    parser.add_argument(
        "--f5-cross-fade-duration",
        type=float,
        default=0.15,
        help="F5 CLI --cross_fade_duration value. Default: 0.15",
    )
    parser.add_argument(
        "--f5-fix-duration-mode",
        choices=["none", "auto"],
        default="none",
        help="Whether to pass F5 CLI --fix_duration. Default: none",
    )
    parser.add_argument(
        "--f5-duration-cps",
        type=float,
        default=10.0,
        help="Estimated generated-text characters per second for auto --fix_duration. Default: 10.0",
    )
    parser.add_argument(
        "--f5-extra-duration",
        type=float,
        default=1.0,
        help="Extra generated duration seconds for auto --fix_duration. Default: 1.0",
    )
    parser.add_argument(
        "--f5-ref-duration-fallback",
        type=float,
        default=0.0,
        help="Fallback ref_audio duration seconds when WAV metadata is invalid. 0 disables. Default: 0",
    )
    parser.add_argument(
        "--f5-max-fix-duration",
        type=float,
        default=30.0,
        help="Skip --fix_duration when calculated duration exceeds this value. Default: 30.0",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    CURRENT_MODE = args.mode
    OUTPUT_DIR = Path(args.output_dir)
    F5_MODEL_PATH = _resolve_path(args.f5_model_path)
    F5_VOCAB_PATH = _resolve_path(args.f5_vocab_path)
    CLEANUP_ENABLED = args.cleanup_enabled
    CLEANUP_INTERVAL_MINUTES = max(0.1, args.cleanup_interval_minutes)
    KEEP_OUTPUT_MINUTES = max(0.0, args.keep_output_minutes)
    MAX_TEXT_CHARS = max(0, args.max_text_chars)
    APPEND_ENDING_PAUSE = args.append_ending_pause
    ENDING_PAUSE_TEXT = args.ending_pause_text
    MIN_OUTPUT_DURATION = max(0.0, args.min_output_duration)
    DEBUG_SAVE_TEXT = args.debug_save_text
    PRONUNCIATION_OVERRIDES_PATH = Path(args.pronunciation_overrides)
    PRONUNCIATION_UI_ENABLED = args.pronunciation_ui_enabled
    RUNTIME_SPEAKERS_DIR = Path(args.runtime_speakers_dir)
    ALLOW_RUNTIME_UPLOAD_OVERWRITE = args.allow_runtime_upload_overwrite
    F5_SPEED = args.f5_speed
    F5_NFE_STEP = args.f5_nfe_step
    F5_CFG_STRENGTH = args.f5_cfg_strength
    F5_SWAY_SAMPLING_COEF = args.f5_sway_sampling_coef
    F5_CROSS_FADE_DURATION = args.f5_cross_fade_duration
    F5_FIX_DURATION_MODE = args.f5_fix_duration_mode
    F5_DURATION_CPS = args.f5_duration_cps
    F5_EXTRA_DURATION = args.f5_extra_duration
    F5_REF_DURATION_FALLBACK = max(0.0, args.f5_ref_duration_fallback)
    F5_MAX_FIX_DURATION = max(0.1, args.f5_max_fix_duration)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    F5_DEBUG_FAILED_DIR.mkdir(parents=True, exist_ok=True)
    F5_DEBUG_TEXT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[{BACKEND_NAME}] server started")
    print(f"[{BACKEND_NAME}] current mode: {CURRENT_MODE}")
    print(f"[{BACKEND_NAME}] output_dir: {OUTPUT_DIR.resolve()}")
    print(f"[{BACKEND_NAME}] cleanup_enabled: {str(CLEANUP_ENABLED).lower()}")
    print(f"[{BACKEND_NAME}] cleanup_interval_minutes: {CLEANUP_INTERVAL_MINUTES}")
    print(f"[{BACKEND_NAME}] keep_output_minutes: {KEEP_OUTPUT_MINUTES}")
    print(f"[{BACKEND_NAME}] max text chars: {MAX_TEXT_CHARS or 'unlimited'}")
    print(f"[{BACKEND_NAME}] append ending pause: {str(APPEND_ENDING_PAUSE).lower()}")
    print(f"[{BACKEND_NAME}] ending pause text: {ENDING_PAUSE_TEXT}")
    print(f"[{BACKEND_NAME}] min output duration: {MIN_OUTPUT_DURATION or 'disabled'}")
    print(f"[{BACKEND_NAME}] debug save text: {str(DEBUG_SAVE_TEXT).lower()}")
    print(f"[{BACKEND_NAME}] pronunciation overrides file path: {PRONUNCIATION_OVERRIDES_PATH}")
    print(f"[{BACKEND_NAME}] pronunciation UI enabled: {str(PRONUNCIATION_UI_ENABLED).lower()}")
    print(f"[{BACKEND_NAME}] runtime speakers dir: {RUNTIME_SPEAKERS_DIR}")
    print(f"[{BACKEND_NAME}] allow runtime upload overwrite: {str(ALLOW_RUNTIME_UPLOAD_OVERWRITE).lower()}")
    print(f"[{BACKEND_NAME}] f5_speed: {F5_SPEED}")
    print(f"[{BACKEND_NAME}] f5_nfe_step: {F5_NFE_STEP}")
    print(f"[{BACKEND_NAME}] f5_cfg_strength: {F5_CFG_STRENGTH}")
    print(f"[{BACKEND_NAME}] f5_sway_sampling_coef: {F5_SWAY_SAMPLING_COEF}")
    print(f"[{BACKEND_NAME}] f5_cross_fade_duration: {F5_CROSS_FADE_DURATION}")
    print(f"[{BACKEND_NAME}] f5_fix_duration_mode: {F5_FIX_DURATION_MODE}")
    print(f"[{BACKEND_NAME}] f5_duration_cps: {F5_DURATION_CPS}")
    print(f"[{BACKEND_NAME}] f5_extra_duration: {F5_EXTRA_DURATION}")
    print(f"[{BACKEND_NAME}] f5_ref_duration_fallback: {F5_REF_DURATION_FALLBACK}")
    print(f"[{BACKEND_NAME}] f5_max_fix_duration: {F5_MAX_FIX_DURATION}")
    print(f"[{BACKEND_NAME}] listening on http://{args.host}:{args.port}")
    _load_pronunciation_overrides()
    if CURRENT_MODE == "mock":
        print(f"[{BACKEND_NAME}] mock mode enabled; real F5-TTS is not loaded")
    elif CURRENT_MODE == "f5":
        print(f"[{BACKEND_NAME}] f5 mode enabled; requests will call {F5_CLI_NAME}")
        print(f"[{BACKEND_NAME}] F5 model path: {F5_MODEL_PATH}")
        print(f"[{BACKEND_NAME}] F5 vocab path: {F5_VOCAB_PATH}")
    else:
        print(f"[{BACKEND_NAME}] f5_persistent mode enabled; loading F5 Python API backend")
        try:
            PERSISTENT_BACKEND = PersistentF5Backend(F5_MODEL_PATH, F5_VOCAB_PATH)
        except Exception as exc:
            print(f"[{BACKEND_NAME}] ERROR: failed to initialize f5_persistent backend: {exc}", flush=True)
            raise SystemExit(1) from exc
    cleanup_thread = _start_cleanup_thread() if CLEANUP_ENABLED else None
    try:
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")
    finally:
        if cleanup_thread is not None:
            CLEANUP_STOP_EVENT.set()
            cleanup_thread.join(timeout=5)
