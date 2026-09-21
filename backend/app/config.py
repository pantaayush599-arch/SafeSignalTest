"""
Central configuration and the frozen constants from the API Contract Review.

Tier 3 constants are explicitly frozen in the contract:
  TIER3_MAX_ATTEMPTS = 3
  TIER3_EXPIRY_SECONDS = 600  (10 minutes)
Do not change these per-role; they are shared by backend, frontend and tests.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'safesignal.db'}")

# --- Frozen Tier 3 constants (API Contract Review, "Resolved" item #5) ---
TIER3_MAX_ATTEMPTS = 3
TIER3_EXPIRY_SECONDS = 600

# --- Tier 1 / Tier 2 verification windows ---
# The contract's own worked example (10:31 -> 10:33) uses a 2-minute Tier 1
# window and (10:34 -> 10:36) a 2-minute Tier 2 window. Reused here verbatim
# rather than inventing different numbers.
TIER1_EXPIRY_SECONDS = 120
TIER2_EXPIRY_SECONDS = 120

# --- Risk score bands ---
# The STT/Architecture doc states explicitly: "The architecture specifies
# 60-100 as HIGH". LOW/MEDIUM boundary is not itself frozen anywhere in the
# source documents; 40 is used as the LOW/MEDIUM split so MEDIUM occupies a
# distinct middle band (40-59) rather than being folded into LOW or HIGH.
RISK_LOW_MAX = 39
RISK_MEDIUM_MAX = 59  # HIGH starts at 60, per the architecture doc.

# --- MEDIUM-risk policy -----------------------------------------------
# UNRESOLVED IN SOURCE DOCUMENTS. The API Contract Review flags this as the
# one genuine team decision still open ("[Decision] MEDIUM risk behavior is
# undefined... Role 1 can't route without it"). This file isolates that gap
# to a single named constant so it is trivial to find and change once the
# team decides, rather than letting an invented policy leak silently into
# scoring/UI/tests as if it were specified.
#
# Placeholder default chosen for this build (NOT specified by any source
# document): treat MEDIUM the same as HIGH for the purposes of the decision
# gateway (decision=PAUSE, verification_required=true, request_status=
# STAYS-PAUSED, Tier 1 begins) on the reasoning that the core safety
# invariant ("no HIGH-risk or paused request may automatically reach ALLOW
# without a positive Tier verification result or an explicit, logged
# MANUAL-OVERRIDE") is never violated by erring toward more verification.
# A future team decision may instead want a lighter-weight MEDIUM path
# (e.g. Tier 1 only, shorter timers, or a distinct ALLOW-with-warning path)
# -- that decision only needs to change this constant and decision_gateway.py.
MEDIUM_RISK_POLICY = "SAME_AS_HIGH"  # options documented above; team-decided value goes here

# --- Audio constraints (STT architecture doc, "Resolved" items) ---
AUDIO_MAX_RAW_BYTES = 5 * 1024 * 1024  # 5 MB raw/decoded, not wire size
AUDIO_MAX_DURATION_SECONDS = 60
AUDIO_ALLOWED_FORMATS = {"wav", "mp3", "webm"}

# --- STT ---
WHISPER_MODEL_SIZE = os.environ.get("SAFESIGNAL_WHISPER_MODEL", "tiny")
WHISPER_DEVICE = os.environ.get("SAFESIGNAL_WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE_TYPE = os.environ.get("SAFESIGNAL_WHISPER_COMPUTE_TYPE", "int8")

CORS_ORIGINS = os.environ.get("SAFESIGNAL_CORS_ORIGINS", "*").split(",")
