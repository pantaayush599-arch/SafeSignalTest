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

Run tests: `pytest` (15 tests covering the full DETECT→PAUSE→VERIFY→DECIDE
flow, all tier outcomes, auth boundaries, and audio errors).

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

## Trying the demo

1. Start both servers.
2. Open the frontend, pick the **requester** persona (Aarav Sharma).
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

## Notes on decisions not fully specified by the source documents

- **MEDIUM risk** is explicitly flagged in the source API Contract Review as
  an unresolved team decision. It's isolated to one constant,
  `MEDIUM_RISK_POLICY` in `backend/app/config.py`, defaulted to the same
  (conservative) path as HIGH risk, with the reasoning documented inline.
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
