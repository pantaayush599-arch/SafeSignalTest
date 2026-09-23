"""
Tests for the features added on top of the frozen verification layer:
Firebase auth (dev-mode), panic button, MEDIUM-risk REVIEW policy, the
family dashboard, and Hindi keyword coverage in the risk engine.
"""
from app.firebase_auth import make_dev_token
from tests.conftest import auth


def test_login_creates_user_idempotently(client):
    token = make_dev_token("phoneuser1", "PHONE", phone_number="+911234500000", name="Phone User")

    r1 = client.post("/auth/login", json={"id_token": token})
    assert r1.status_code == 200
    body1 = r1.json()
    assert body1["created"] is True
    assert body1["requester_id"] == "dev:phoneuser1"
    assert body1["auth_provider"] == "PHONE"
    session_token = body1["session_token"]

    r2 = client.post("/auth/login", json={"id_token": token})
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2["created"] is False
    assert body2["session_token"] == session_token  # same row, same session token

    # the session token returned actually authenticates against other endpoints
    r3 = client.get(f"/requesters/{body2['requester_id']}/dashboard", headers=auth(session_token))
    assert r3.status_code == 200
    assert r3.json()["entries"] == []


def test_login_rejects_garbage_token_cleanly(client):
    r = client.post("/auth/login", json={"id_token": "not-a-real-token"})
    assert r.status_code == 401
    assert r.json()["detail"]["error"]["code"] == "INVALID_FIREBASE_TOKEN"


def test_login_google_provider(client):
    token = make_dev_token("googleuser1", "GOOGLE", email="someone@example.com", name="Google User")
    r = client.post("/auth/login", json={"id_token": token})
    assert r.status_code == 200
    assert r.json()["auth_provider"] == "GOOGLE"
    assert r.json()["email"] == "someone@example.com"


def test_analyze_request_rejects_unauthenticated_caller_cleanly(client):
    r = client.post("/analyze-request", json={
        "request_id": "req_noauth", "requester_id": "user_102", "action_type": "wallet_transfer",
        "channel": "text", "input_type": "TEXT", "transcript_or_text": "hello",
    })
    assert r.status_code == 401  # never a raw 500


def test_panic_button_pauses_and_starts_tier1(client, tokens):
    r = client.post("/panic", json={"note": "Something feels wrong about this call."}, headers=auth(tokens["requester"]))
    assert r.status_code == 200
    body = r.json()
    assert body["risk_level"] == "HIGH"
    assert body["request_status"] == "STAYS-PAUSED"
    assert body["reason_codes"] == ["manual_panic_trigger"]

    state = client.get(f"/requests/{body['request_id']}", headers=auth(tokens["requester"])).json()
    assert state["current_tier"] == 1
    assert len(state["verifications"]) == 1


def test_panic_button_is_idempotent_per_request_id(client, tokens):
    r1 = client.post("/panic", json={"request_id": "req_panic_fixed"}, headers=auth(tokens["requester"]))
    r2 = client.post("/panic", json={"request_id": "req_panic_fixed"}, headers=auth(tokens["requester"]))
    assert r1.json() == r2.json()


def test_medium_risk_is_advisory_review_not_paused_or_verified(client, tokens):
    r = client.post("/analyze-request", json={
        "request_id": "req_medium", "requester_id": "user_102", "action_type": "wallet_transfer",
        "channel": "text", "input_type": "TEXT",
        "transcript_or_text": "Please send me the money right now, I need it",
    }, headers=auth(tokens["requester"]))
    assert r.status_code == 200
    body = r.json()
    assert body["risk_level"] == "MEDIUM"
    assert body["decision"] == "REVIEW"
    assert body["verification_required"] is False
    # Neither locked (STAYS-PAUSED) nor auto-unlocked (VERIFIED).
    assert body["request_status"] == "PENDING"


def test_hindi_scam_phrases_are_detected(client, tokens):
    r = client.post("/analyze-request", json={
        "request_id": "req_hindi", "requester_id": "user_102", "action_type": "wallet_transfer",
        "channel": "voice_call", "input_type": "TEXT",
        "transcript_or_text": "papa main giraftar ho gaya hoon, turant paise bhejo, kisi ko mat batana",
    }, headers=auth(tokens["requester"]))
    assert r.status_code == 200
    body = r.json()
    assert body["risk_level"] == "HIGH"
    assert set(["money_request", "emergency_claim", "secrecy_request", "urgency_keyword"]).issubset(set(body["reason_codes"]))


def test_risk_scores_are_not_all_multiples_of_ten(client, tokens):
    scored = []
    cases = [
        "send money right now",
        "papa giraftar ho gaya, paise bhejo",
        "what's your favorite color",
        "please share the otp immediately, urgent",
    ]
    for i, text in enumerate(cases):
        r = client.post("/analyze-request", json={
            "request_id": f"req_score_{i}", "requester_id": "user_102", "action_type": "wallet_transfer",
            "channel": "text", "input_type": "TEXT", "transcript_or_text": text,
        }, headers=auth(tokens["requester"]))
        scored.append(r.json()["risk_score"])
    assert any(s % 10 != 0 for s in scored if s > 0)


def test_family_dashboard_lists_requester_requests_and_is_ownership_checked(client, tokens):
    client.post("/analyze-request", json={
        "request_id": "req_dash1", "requester_id": "user_102", "action_type": "wallet_transfer",
        "channel": "text", "input_type": "TEXT", "transcript_or_text": "hi there",
    }, headers=auth(tokens["requester"]))

    r = client.get("/requesters/user_102/dashboard", headers=auth(tokens["requester"]))
    assert r.status_code == 200
    body = r.json()
    assert body["requester_id"] == "user_102"
    assert any(e["request_id"] == "req_dash1" for e in body["entries"])

    # A family member (registered trusted contact) can also see it.
    r2 = client.get("/requesters/user_102/dashboard", headers=auth(tokens["contact1"]))
    assert r2.status_code == 200

    # A stranger token cannot.
    r3 = client.get("/requesters/user_102/dashboard", headers={"Authorization": "Bearer not-a-real-token"})
    assert r3.status_code == 401
