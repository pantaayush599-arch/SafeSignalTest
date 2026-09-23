# SafeSignal — Family Deepfake Emergency Shield

Detects high-risk, deepfake-style emergency requests, pauses the
consequential action, and requires independent verification (Tier 1 trusted
contact → Tier 2 escalation → Tier 3 one-time code) before anything is
allowed. Manual override is always available, always explicit, always
logged, and never looks like a normal verification.

## Project structure

```
backend/    FastAPI + SQLAlchemy + SQLite API (risk engine, decision gateway,
            STT, verification state machine, WebSocket, audit log)
frontend/   Vite + React + TypeScript + Tailwind — requester app and
            trusted-contact app in one codebase, routed by persona
```

## Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Runs on `http://127.0.0.1:8000`. On first start it creates `safesignal.db`
(SQLite) and seeds one demo requester (`user_102`) with a primary and
secondary trusted contact. `GET /demo/identities` lists their tokens (used
by the frontend's persona picker — see the note on demo-only additions
below).

Run tests: `pytest` (25 tests covering the full DETECT→PAUSE→VERIFY→DECIDE
flow, all tier outcomes, auth boundaries, audio errors, Firebase login,
the panic button, the MEDIUM/REVIEW path, and the family dashboard).

### Firebase auth

`POST /auth/login` verifies a Firebase ID token server-side
(`firebase-admin`) and idempotently gets-or-creates the requester row by
Firebase UID. Real mode activates automatically once
`SAFESIGNAL_FIREBASE_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS` (or just
`SAFESIGNAL_FIREBASE_PROJECT_ID` for an already-authenticated environment)
are set. With neither configured, set `SAFESIGNAL_AUTH_DEV_MODE=true` to
accept the clearly-tagged, non-cryptographic dev tokens `app/firebase_auth.py`
generates (every use logs a warning) — this is what the demo scripts below
use, since no real Firebase project is available to test against here. Dev
mode never activates by accident: with it off and no real credentials,
`/auth/login` fails cleanly with `INVALID_FIREBASE_TOKEN` rather than
silently trusting a client-supplied identity.

### Speech-to-text

Audio transcription uses `faster-whisper`, downloading the `tiny` model
from Hugging Face on first use. If the model can't be downloaded (e.g. no
network access), `/analyze-request` returns `STT_FAILED` gracefully and the
request stays `STAYS-PAUSED` — it never falls through to `ALLOW`. Configure
via `SAFESIGNAL_WHISPER_MODEL` / `SAFESIGNAL_WHISPER_DEVICE` /
`SAFESIGNAL_WHISPER_COMPUTE_TYPE` env vars.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_BASE_URL, defaults to http://127.0.0.1:8000
npm run dev
```

Runs on `http://127.0.0.1:5173`. Build for production with `npm run build`.
Copy `VITE_FIREBASE_*` from a real Firebase project into `.env` to enable
real phone-OTP/Google sign-in on the login page; leave them unset (the
default) and the page falls back to the demo persona picker, which is the
only path tested in this build environment.

## Trying the demo

1. Start both servers (backend with `SAFESIGNAL_AUTH_DEV_MODE=true` if you
   want to exercise `/auth/login` without a real Firebase project).
2. Open the frontend, pick the **requester** persona (Aarav Sharma) from
   the demo picker, or sign in for real if you've configured Firebase.
3. Click the "High-risk" quick-fill scenario and Analyze — watch it get
   paused and Tier 1 auto-start.
4. In another browser tab/window, pick a **trusted contact** persona and
   confirm or reject the verification request. The requester tab updates
   live over WebSocket.
5. Reject Tier 1 and Tier 2 to see escalation all the way to the Tier 3
   one-time code (shown on the primary contact's verification page, since
   this prototype has no real SMS/telephony integration — see note below).
6. Try **Manual override** from the requester side to see the explicit,
   logged, visually-distinct bypass path.
7. Try the red **"I think this is a scam"** panic button (bottom-right on
   any requester screen) — it pauses and starts Tier 1 independently of the
   automatic risk engine.
8. Analyze "Please send me the money right now, I need it" to see the
   MEDIUM-risk advisory path: not locked, not auto-approved, a distinct
   blue "review before proceeding" screen.
9. Visit **Family dashboard** (nav bar) to see recent flagged requests
   across the account, visible to the requester and their trusted contacts.
10. Analyze a Hindi/romanized-Hindi message, e.g. *"papa main giraftar ho
    gaya hoon, turant paise bhejo, kisi ko mat batana"*, to see multi-language
    detection.

## Feature scope

A later round of scope discussion narrowed the "additional features" list
to four, prioritizing depth on the core DETECT→PAUSE→VERIFY→DECIDE loop
over feature count:

**Built:** manual panic button, one-tap fraud reporting (`cybercrime.gov.in`
+ tel:1930), a simple family dashboard, Hindi/romanized-Hindi keyword
coverage in the risk engine, and continuous (non-round) 0–100 risk scores.

**Explicitly not built**, per that scope decision — known-contact checking
and a crowd-reported scam-number list were evaluated and deprioritized as
optional/future rather than core to the product's differentiation (pausing
+ independently verifying a risky action, not scam-number identification).
Live/background call-audio listening, background SMS reading, a
SafeSignal-owned VoIP layer, voice enrollment/speaker verification, a
payment-notification listener, and an automatic post-call nudge were never
built — several are Android OS-level restrictions no third-party app can
lift, not permission-dialog problems, and none of them fit a browser-based
web app regardless.

## Notes on decisions not fully specified by the source documents

- **MEDIUM risk** is explicitly flagged in the source API Contract Review as
  an unresolved team decision. `backend/app/decision_gateway.py` implements
  a concrete placeholder (`decision=REVIEW`, `verification_required=false`,
  `request_status=PENDING` — neither the STAYS-PAUSED lock nor the VERIFIED
  auto-unlock, so the frontend renders a third, distinct "review before you
  proceed" screen), tagged with a `# TODO: pending official sign-off, see
  API contract review item #1` comment so it's easy to find and override.
- **Tier 3 code delivery**: the contract defines the endpoints but not which
  UI shows the plaintext code (only that it's hashed server-side and never
  returned in the normal response). This build surfaces it once, on the
  primary trusted contact's verification page, with an explicit "DEMO NOTE"
  in the UI, since the prototype has no real SMS/voice channel to deliver it
  out-of-band.
- **Demo authentication**: the source documents call for "role-based access
  (requester vs. trusted contact)" without specifying a mechanism. This
  build uses simple per-identity bearer tokens (`GET /demo/identities`),
  which close the three concrete authorization gaps the contract review
  flagged (override is requester-only, a contact can only respond to their
  own assigned verification, and request/WS access checks ownership rather
  than trusting a UUID).

## Known limitations

- Speech-to-text requires downloading a Whisper model on first run; offline
  environments will see graceful `STT_FAILED` responses instead of working
  transcription (by design — the request stays paused, never auto-allowed).
- Tier 1/2/3 "push notifications" and SMS delivery are simulated by the
  in-app inbox and WebSocket push, not real FCM/SMS integration.
- The wallet transfer is fully simulated; no real payment provider is
  connected, per the prototype's explicit scope.
