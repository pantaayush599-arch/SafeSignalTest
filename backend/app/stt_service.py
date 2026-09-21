"""
Speech-to-Text service (Role 6's input-intelligence pipeline).

Audio -> STT -> Transcript. This module ONLY transcribes; it never judges
whether a voice is real or synthetic (that is the separate, optional,
advisory deepfake_signal_score field, handled entirely outside this module).

Two distinct failure modes, per the STT/Architecture doc:
  - AudioUnprocessableError: bad input (silent, wrong format, corrupt,
    exceeds the frozen size/duration limits). Caller error.
  - STTFailedError: the Whisper service itself errored/timed out. Service
    error, not a bad-input error.
Both are handled identically by the caller (request_status stays
STAYS-PAUSED) but are reported as different error codes so the frontend can
show the right message ("try a different file" vs "try again").
"""
import base64
import binascii
import io
import wave
from dataclasses import dataclass

from app.config import (
    AUDIO_MAX_RAW_BYTES, AUDIO_MAX_DURATION_SECONDS, AUDIO_ALLOWED_FORMATS,
    WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE,
)


class AudioUnprocessableError(Exception):
    pass


class STTFailedError(Exception):
    pass


@dataclass
class DecodedAudio:
    raw_bytes: bytes
    fmt: str
    duration_seconds: float | None


_MAGIC_BYTES = {
    b"RIFF": "wav",
    b"ID3": "mp3",
    b"\x1a\x45\xdf\xa3": "webm",  # EBML header used by webm/mkv
}


def _sniff_format(raw: bytes) -> str | None:
    if raw[:4] == b"RIFF" and raw[8:12] == b"WAVE":
        return "wav"
    if raw[:3] == b"ID3" or (len(raw) > 2 and raw[0] == 0xFF and (raw[1] & 0xE0) == 0xE0):
        return "mp3"
    if raw[:4] == b"\x1a\x45\xdf\xa3":
        return "webm"
    return None


def _wav_duration(raw: bytes) -> float | None:
    try:
        with wave.open(io.BytesIO(raw), "rb") as w:
            frames = w.getnframes()
            rate = w.getframerate()
            return frames / float(rate) if rate else None
    except (wave.Error, EOFError):
        return None


def decode_and_validate(audio_b64: str) -> DecodedAudio:
    """Decode base64 and enforce the frozen constraints server-side
    (contract: Role 1 re-validates server-side even though Role 5/frontend
    already validated client-side)."""
    try:
        raw = base64.b64decode(audio_b64, validate=True)
    except (binascii.Error, ValueError):
        raise AudioUnprocessableError("Audio payload is not valid base64.")

    if not raw:
        raise AudioUnprocessableError("Audio payload is empty (silent/no data).")

    if len(raw) > AUDIO_MAX_RAW_BYTES:
        raise AudioUnprocessableError(
            f"Audio exceeds the maximum size of {AUDIO_MAX_RAW_BYTES // (1024*1024)} MB (raw)."
        )

    fmt = _sniff_format(raw)
    if fmt is None or fmt not in AUDIO_ALLOWED_FORMATS:
        raise AudioUnprocessableError("Unsupported or unrecognized audio format (expected WAV, MP3 or WebM).")

    duration = _wav_duration(raw) if fmt == "wav" else None
    if duration is not None and duration > AUDIO_MAX_DURATION_SECONDS:
        raise AudioUnprocessableError(
            f"Audio exceeds the maximum duration of {AUDIO_MAX_DURATION_SECONDS} seconds."
        )

    return DecodedAudio(raw_bytes=raw, fmt=fmt, duration_seconds=duration)


class WhisperTranscriber:
    """Thin wrapper around faster-whisper. Lazily loads the model on first
    use so importing this module (and running unit tests that don't touch
    audio) never pays the model-load cost."""

    def __init__(self):
        self._model = None

    def _load(self):
        if self._model is not None:
            return self._model
        try:
            from faster_whisper import WhisperModel
        except ImportError as exc:
            raise STTFailedError(f"faster-whisper is not installed: {exc}")
        try:
            self._model = WhisperModel(
                WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE
            )
        except Exception as exc:
            raise STTFailedError(f"Failed to load Whisper model: {exc}")
        return self._model

    def transcribe(self, decoded: DecodedAudio) -> str:
        model = self._load()
        suffix = f".{decoded.fmt}"
        import tempfile, os
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(decoded.raw_bytes)
                tmp_path = tmp.name
            segments, _info = model.transcribe(tmp_path, beam_size=1)
            text = " ".join(seg.text.strip() for seg in segments).strip()
        except Exception as exc:
            raise STTFailedError(f"Whisper transcription failed: {exc}")
        finally:
            if tmp_path:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        if not text:
            raise AudioUnprocessableError("Audio could not be transcribed (silent, unsupported format, or corrupt).")
        return text


transcriber = WhisperTranscriber()
