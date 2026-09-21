"""
End-to-end tests for the DETECT -> PAUSE -> VERIFY -> DECIDE pipeline,
covering the scenarios from the task's own test matrix: LOW risk, HIGH
risk, Tier 1 confirm/reject, Tier 2 confirm/reject, Tier 3 success/wrong
code/expiry/exhaustion, manual override, duplicate requests, audio errors,
and authorization boundaries.
"""
from datetime import datetime, timedelta

from tests.conftest import auth

HIGH_RISK_TEXT = "Dad, I have been arrested. Send 80000 immediately. Don't tell mom."


def analyze(client, tokens, request_id, text=HIGH_RISK_TEXT, **extra):
    body = {
        "request_id": request_id,
        "requester_id": "user_102",
        "action_type": "wallet_transfer",
        "channel": "voice_call",
        "input_type": "TEXT",
        "transcript_or_text": text,
        "claimed_identity": "son",
    }
    body.update(extra)
    return client.post("/analyze-request", json=body, headers=auth(tokens["requester"]))


def get_state(client, tokens, request_id):
    return client.get(f"/requests/{request_id}", headers=auth(tokens["requester"])).json()


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_low_risk_auto_allows_without_verification(client, tokens):
    r = analyze(client, tokens, "req_low", text="Hey, want to grab lunch tomorrow?")
    assert r.status_code == 200
    body = r.json()
    assert body["risk_level"] == "LOW"
    assert body["decision"] == "ALLOW"
    assert body["verification_required"] is False
    assert body["request_status"] == "VERIFIED"


def test_high_risk_pauses_and_starts_tier1(client, tokens):
    r = analyze(client, tokens, "req_high")
    assert r.status_code == 200
    body = r.json()
    assert body["risk_level"] == "HIGH"
    assert body["decision"] == "PAUSE"
    assert body["verification_required"] is True
    assert body["request_status"] == "STAYS-PAUSED"
    assert set(["money_request", "emergency_claim", "secrecy_request"]).issubset(set(body["reason_codes"]))

    state = get_state(client, tokens, "req_high")
    assert state["current_tier"] == 1
    assert len(state["verifications"]) == 1
    assert state["verifications"][0]["tier"] == 1
    assert state["verifications"][0]["status"] == "PENDING"


def test_duplicate_analyze_request_is_idempotent(client, tokens):
    r1 = analyze(client, tokens, "req_dup")
    r2 = analyze(client, tokens, "req_dup", text="completely different text")
    assert r1.json() == r2.json()


def test_tier1_confirm_unlocks_action(client, tokens):
    analyze(client, tokens, "req_t1_confirm")
    state = get_state(client, tokens, "req_t1_confirm")
    vid = state["verifications"][0]["verification_id"]

    r = client.post("/verify/tier1/respond", json={"verification_id": vid, "response": "CONFIRMED"},
                     headers=auth(tokens["contact1"]))
    assert r.status_code == 200
    assert r.json()["request_status"] == "VERIFIED"


def test_tier1_reject_never_unlocks_and_escalates_to_tier2(client, tokens):
    analyze(client, tokens, "req_t1_reject")
    state = get_state(client, tokens, "req_t1_reject")
    vid = state["verifications"][0]["verification_id"]

    r = client.post("/verify/tier1/respond", json={"verification_id": vid, "response": "REJECTED"},
                     headers=auth(tokens["contact1"]))
    assert r.status_code == 200
    assert r.json()["request_status"] == "STAYS-PAUSED"  # never unlocks on rejection

    state = get_state(client, tokens, "req_t1_reject")
    assert state["current_tier"] == 2
    assert state["request_status"] == "STAYS-PAUSED"


def test_full_escalation_to_tier3_and_confirm(client, tokens):
    analyze(client, tokens, "req_full_chain")
    state = get_state(client, tokens, "req_full_chain")
    v1 = state["verifications"][0]["verification_id"]
    client.post("/verify/tier1/respond", json={"verification_id": v1, "response": "REJECTED"},
                headers=auth(tokens["contact1"]))

    state = get_state(client, tokens, "req_full_chain")
    v2 = [v for v in state["verifications"] if v["tier"] == 2][0]["verification_id"]
    client.post("/verify/tier2/respond", json={"verification_id": v2, "response": "REJECTED"},
                headers=auth(tokens["contact2"]))

    state = get_state(client, tokens, "req_full_chain")
    assert state["current_tier"] == 3
    assert state["request_status"] == "STAYS-PAUSED"

    inbox = client.get("/contacts/contact_101/inbox", headers=auth(tokens["contact1"])).json()
    item = [i for i in inbox if i["request_id"] == "req_full_chain" and i["tier"] == 3][0]
    code = item["demo_code"]
    v3 = [v for v in state["verifications"] if v["tier"] == 3][0]["verification_id"]

    # wrong code first
    wrong = client.post("/verify/tier3/submit", json={"verification_id": v3, "code": "000000"},
                         headers=auth(tokens["requester"]))
    assert wrong.status_code == 200
    assert wrong.json()["status"] == "PENDING"
    assert wrong.json()["attempts_remaining"] == 2

    # then correct code
    right = client.post("/verify/tier3/submit", json={"verification_id": v3, "code": code},
                         headers=auth(tokens["requester"]))
    assert right.status_code == 200
    assert right.json()["request_status"] == "VERIFIED"


def test_tier3_attempts_exhausted_times_out_request(client, tokens):
    analyze(client, tokens, "req_t3_exhaust")
    state = get_state(client, tokens, "req_t3_exhaust")
    v1 = state["verifications"][0]["verification_id"]
    client.post("/verify/tier1/respond", json={"verification_id": v1, "response": "REJECTED"}, headers=auth(tokens["contact1"]))
    state = get_state(client, tokens, "req_t3_exhaust")
    v2 = [v for v in state["verifications"] if v["tier"] == 2][0]["verification_id"]
    client.post("/verify/tier2/respond", json={"verification_id": v2, "response": "REJECTED"}, headers=auth(tokens["contact2"]))

    state = get_state(client, tokens, "req_t3_exhaust")
    v3 = [v for v in state["verifications"] if v["tier"] == 3][0]["verification_id"]

    for _ in range(3):
        resp = client.post("/verify/tier3/submit", json={"verification_id": v3, "code": "999999"},
                            headers=auth(tokens["requester"]))

    assert resp.json()["attempts_remaining"] == 0
    state = get_state(client, tokens, "req_t3_exhaust")
    assert state["request_status"] == "TIMED-OUT"

    # a further attempt is now rejected outright
    resp2 = client.post("/verify/tier3/submit", json={"verification_id": v3, "code": "999999"},
                         headers=auth(tokens["requester"]))
    assert resp2.status_code == 429


def test_manual_override_is_distinct_from_verified_and_logged(client, tokens):
    analyze(client, tokens, "req_override")
    r = client.post("/requests/req_override/manual-override",
                     json={"reason": "Verified in person.", "confirmation": True},
                     headers=auth(tokens["requester"]))
    assert r.status_code == 200
    assert r.json()["request_status"] == "MANUAL-OVERRIDE"
    assert r.json()["request_status"] != "VERIFIED"

    audit = client.get("/requests/req_override/audit", headers=auth(tokens["requester"])).json()
    events = [e["event"] for e in audit["events"]]
    assert "MANUAL_OVERRIDE" in events


def test_manual_override_requires_confirmation_flag(client, tokens):
    analyze(client, tokens, "req_override_noconfirm")
    r = client.post("/requests/req_override_noconfirm/manual-override",
                     json={"reason": "test", "confirmation": False},
                     headers=auth(tokens["requester"]))
    assert r.status_code == 422


def test_trusted_contact_cannot_respond_to_unassigned_verification(client, tokens):
    analyze(client, tokens, "req_wrong_contact")
    state = get_state(client, tokens, "req_wrong_contact")
    vid = state["verifications"][0]["verification_id"]

    # contact2 is not assigned to this tier1 verification (contact1 is)
    r = client.post("/verify/tier1/respond", json={"verification_id": vid, "response": "CONFIRMED"},
                     headers=auth(tokens["contact2"]))
    assert r.status_code == 403


def test_get_request_requires_ownership(client, tokens):
    r = client.get("/requests/req_low", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_unknown_request_returns_404(client, tokens):
    r = client.get("/requests/does_not_exist", headers=auth(tokens["requester"]))
    assert r.status_code == 404
    assert r.json()["detail"]["error"]["code"] == "REQUEST_NOT_FOUND"


def test_audio_invalid_base64_is_unprocessable_and_stays_paused(client, tokens):
    r = client.post("/analyze-request", json={
        "request_id": "req_bad_audio", "requester_id": "user_102", "action_type": "wallet_transfer",
        "channel": "voice_call", "input_type": "AUDIO", "audio": "not-valid-base64!!!",
    }, headers=auth(tokens["requester"]))
    assert r.status_code == 422
    assert r.json()["detail"]["error"]["code"] == "AUDIO_UNPROCESSABLE"
    assert r.json()["detail"]["request_status"] == "STAYS-PAUSED"


def test_tier3_expired_returns_410_and_times_out_request(client, tokens):
    analyze(client, tokens, "req_t3_expiry")
    state = get_state(client, tokens, "req_t3_expiry")
    v1 = state["verifications"][0]["verification_id"]
    client.post("/verify/tier1/respond", json={"verification_id": v1, "response": "REJECTED"}, headers=auth(tokens["contact1"]))
    state = get_state(client, tokens, "req_t3_expiry")
    v2 = [v for v in state["verifications"] if v["tier"] == 2][0]["verification_id"]
    client.post("/verify/tier2/respond", json={"verification_id": v2, "response": "REJECTED"}, headers=auth(tokens["contact2"]))
    state = get_state(client, tokens, "req_t3_expiry")
    v3 = [v for v in state["verifications"] if v["tier"] == 3][0]["verification_id"]

    # Force the Tier 3 verification into the past to simulate expiry.
    from app import database
    from app.models import Verification
    db = database.SessionLocal()
    try:
        row = db.query(Verification).filter(Verification.verification_id == v3).first()
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()

    r = client.post("/verify/tier3/submit", json={"verification_id": v3, "code": "123456"},
                     headers=auth(tokens["requester"]))
    assert r.status_code == 410
    assert r.json()["detail"]["error"]["code"] == "VERIFICATION_EXPIRED"

    state = get_state(client, tokens, "req_t3_expiry")
    assert state["request_status"] == "TIMED-OUT"
