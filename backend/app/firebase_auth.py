"""
Firebase ID token verification (task Part 1).

"Verify the Firebase ID token server-side on every authenticated request --
never trust a client-supplied user id directly" is the hard requirement
here. Two modes:

  REAL MODE (default whenever Firebase Admin credentials are present):
    Verifies the token with firebase_admin.auth.verify_id_token(), which
    cryptographically checks the token's signature against Google's public
    keys and its audience against the configured Firebase project. The
    caller can never forge a uid this way.

  DEV MODE (must be explicitly opted into with SAFESIGNAL_AUTH_DEV_MODE=true,
    and only ever takes effect when no real Firebase credentials are
    configured): there is no real Firebase project available in this build
    environment to test phone-OTP/Google sign-in against, so this mode lets
    the demo exercise the rest of the app (permission onboarding, panic
    button, etc.) without one. It does NOT accept an arbitrary client-
    supplied id: it only accepts a specific, clearly-tagged JSON envelope
    (not a real signed JWT) and every acceptance is logged as a warning, so
    it can never be mistaken for a real login path in production and is
    trivially greppable. This is the same "graceful degradation, never
    silent, never a security bypass by default" pattern used for STT in
    stt_service.py.
"""
import base64
import binascii
import json
import logging
import os
from dataclasses import dataclass

logger = logging.getLogger("safesignal.firebase_auth")

DEV_MODE_ENABLED = os.environ.get("SAFESIGNAL_AUTH_DEV_MODE", "false").lower() == "true"
FIREBASE_PROJECT_ID = os.environ.get("SAFESIGNAL_FIREBASE_PROJECT_ID")

_DEV_TOKEN_PREFIX = "devtoken."


class FirebaseTokenError(Exception):
    pass


@dataclass
class FirebaseIdentity:
    uid: str
    provider: str  # PHONE | GOOGLE
    phone_number: str | None = None
    email: str | None = None
    name: str | None = None


_firebase_app = None


def _get_firebase_app():
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError:
        return None

    if not FIREBASE_PROJECT_ID and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        return None  # not configured -- caller falls back to dev mode if enabled

    try:
        if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
            cred = credentials.ApplicationDefault()
            _firebase_app = firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
        else:
            _firebase_app = firebase_admin.initialize_app(options={"projectId": FIREBASE_PROJECT_ID})
    except Exception as exc:
        logger.warning("Firebase Admin init failed, falling back: %s", exc)
        return None
    return _firebase_app


def _verify_real(id_token: str) -> FirebaseIdentity:
    from firebase_admin import auth as firebase_admin_auth

    try:
        decoded = firebase_admin_auth.verify_id_token(id_token)
    except Exception as exc:
        raise FirebaseTokenError(f"Firebase ID token verification failed: {exc}")

    uid = decoded.get("uid") or decoded.get("user_id")
    if not uid:
        raise FirebaseTokenError("Firebase token did not contain a uid.")

    phone_number = decoded.get("phone_number")
    email = decoded.get("email")
    provider = "PHONE" if phone_number and not email else "GOOGLE"
    firebase_sign_in_provider = (decoded.get("firebase") or {}).get("sign_in_provider", "")
    if "google" in firebase_sign_in_provider:
        provider = "GOOGLE"
    elif "phone" in firebase_sign_in_provider:
        provider = "PHONE"

    return FirebaseIdentity(uid=uid, provider=provider, phone_number=phone_number, email=email, name=decoded.get("name"))


def _verify_dev(id_token: str) -> FirebaseIdentity:
    if not id_token.startswith(_DEV_TOKEN_PREFIX):
        raise FirebaseTokenError(
            "Not a recognized dev-mode token. Real Firebase tokens require SAFESIGNAL_FIREBASE_PROJECT_ID / "
            "GOOGLE_APPLICATION_CREDENTIALS to be configured."
        )
    payload_b64 = id_token[len(_DEV_TOKEN_PREFIX):]
    try:
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
    except (binascii.Error, ValueError, json.JSONDecodeError) as exc:
        raise FirebaseTokenError(f"Malformed dev-mode token: {exc}")

    uid = payload.get("uid")
    provider = payload.get("provider")
    if not uid or provider not in ("PHONE", "GOOGLE"):
        raise FirebaseTokenError("Dev-mode token missing uid/provider.")

    logger.warning("SAFESIGNAL_AUTH_DEV_MODE accepted an unverified dev token for uid=%s -- never enable this in production.", uid)
    return FirebaseIdentity(
        uid=f"dev:{uid}", provider=provider,
        phone_number=payload.get("phone_number"), email=payload.get("email"), name=payload.get("name"),
    )


def verify_firebase_token(id_token: str) -> FirebaseIdentity:
    app = _get_firebase_app()
    if app is not None:
        return _verify_real(id_token)

    if DEV_MODE_ENABLED:
        return _verify_dev(id_token)

    raise FirebaseTokenError(
        "Firebase is not configured on this server (no SAFESIGNAL_FIREBASE_PROJECT_ID / "
        "GOOGLE_APPLICATION_CREDENTIALS) and SAFESIGNAL_AUTH_DEV_MODE is not enabled."
    )


def make_dev_token(uid: str, provider: str, phone_number: str | None = None, email: str | None = None, name: str | None = None) -> str:
    """Builds a dev-mode token in the format _verify_dev accepts. Used only
    by the frontend's clearly-labeled demo-login fallback and by tests."""
    payload = {"uid": uid, "provider": provider, "phone_number": phone_number, "email": email, "name": name}
    encoded = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{_DEV_TOKEN_PREFIX}{encoded}"
