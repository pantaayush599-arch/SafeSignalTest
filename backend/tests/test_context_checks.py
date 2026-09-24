"""
Tests for the known-contact number check and the crowd-reported
scam-number database (team scope: both marked optional/future, added back
on explicit request). Seeded fixtures: Priya Sharma ("Mother",
+919876500101) is the PRIMARY trusted contact for user_102; a scam number
+911800000666 is pre-seeded with two reports (see app/seed.py).
"""
from tests.conftest import auth

SCAM_NUMBER = "+911800000666"
MOTHER_NUMBER = "+919876500101"


def analyze(client, token, request_id, text, claimed_identity=None, caller_phone_number=None):
    return client.post("/analyze-request", json={
        "request_id": request_id, "requester_id": "user_102", "action_type": "wallet_transfer",
        "channel": "voice_call", "input_type": "TEXT", "transcript_or_text": text,
        "claimed_identity": claimed_identity, "caller_phone_number": caller_phone_number,
    }, headers=auth(token))


def test_known_contact_number_mismatch_is_flagged_as_a_risk_signal(client, tokens):
    r = analyze(
        client, tokens["requester"], "req_kc_mismatch",
        "Hi, it's urgent, please call me back right away.",
        claimed_identity="Mother", caller_phone_number="+919999999999",
    )
    body = r.json()
    assert "known_contact_number_mismatch" in body["reason_codes"]

    state = client.get("/requests/req_kc_mismatch", headers=auth(tokens["requester"])).json()
    assert state["known_contact_checked"] is True
    assert state["known_contact_match"] is False
    assert state["known_contact_name"] == "Priya Sharma"


def test_known_contact_number_match_is_not_flagged(client, tokens):
    r = analyze(
        client, tokens["requester"], "req_kc_match", "just checking in, how are you",
        claimed_identity="Mother", caller_phone_number=MOTHER_NUMBER,
    )
    body = r.json()
    assert "known_contact_number_mismatch" not in body["reason_codes"]

    state = client.get("/requests/req_kc_match", headers=auth(tokens["requester"])).json()
    assert state["known_contact_checked"] is True
    assert state["known_contact_match"] is True


def test_claimed_identity_with_no_matching_trusted_contact_is_not_a_mismatch(client, tokens):
    r = analyze(
        client, tokens["requester"], "req_kc_na", "your account will be blocked, share the otp",
        claimed_identity="bank support executive", caller_phone_number="+919999999999",
    )
    body = r.json()
    assert "known_contact_number_mismatch" not in body["reason_codes"]

    state = client.get("/requests/req_kc_na", headers=auth(tokens["requester"])).json()
    assert state["known_contact_checked"] is True
    assert state["known_contact_match"] is None


def test_known_contact_check_is_skipped_without_a_caller_number(client, tokens):
    r = analyze(client, tokens["requester"], "req_kc_none", "hello there", claimed_identity="Mother")
    assert "known_contact_number_mismatch" not in r.json()["reason_codes"]
    state = client.get("/requests/req_kc_none", headers=auth(tokens["requester"])).json()
    assert state["known_contact_checked"] is False


def test_seeded_scam_number_is_flagged_and_raises_risk(client, tokens):
    r = analyze(
        client, tokens["requester"], "req_scam_seeded",
        "Your account will be blocked in 5 minutes, share the OTP immediately.",
        claimed_identity="bank support executive", caller_phone_number=SCAM_NUMBER,
    )
    body = r.json()
    assert "reported_scam_number" in body["reason_codes"]
    assert body["risk_level"] == "HIGH"

    state = client.get("/requests/req_scam_seeded", headers=auth(tokens["requester"])).json()
    assert state["reported_scam_number"] is True
    assert state["scam_report_count"] == 2


def test_unreported_number_is_not_flagged(client, tokens):
    r = analyze(
        client, tokens["requester"], "req_scam_clean", "hello there",
        caller_phone_number="+919111111111",
    )
    body = r.json()
    assert "reported_scam_number" not in body["reason_codes"]
    state = client.get("/requests/req_scam_clean", headers=auth(tokens["requester"])).json()
    assert state["reported_scam_number"] is False
    assert state["scam_report_count"] == 0


def test_report_then_lookup_round_trips(client, tokens):
    r = client.post("/scam-reports", json={
        "phone_number": "+91 90000 12345", "reason": "Impersonated grandson, asked for hospital bill money.",
    }, headers=auth(tokens["requester"]))
    assert r.status_code == 201
    assert r.json()["phone_number"] == "+91 90000 12345"

    lookup = client.get("/scam-reports/lookup", params={"phone_number": "9000012345"}, headers=auth(tokens["requester"]))
    assert lookup.status_code == 200
    assert lookup.json() == {"phone_number": "9000012345", "reported": True, "report_count": 1}


def test_reporting_closes_the_loop_into_future_analyze_requests(client, tokens):
    fresh_number = "+919222233334"
    before = analyze(client, tokens["requester"], "req_before_report", "hello", caller_phone_number=fresh_number)
    assert "reported_scam_number" not in before.json()["reason_codes"]

    report = client.post("/scam-reports", json={"phone_number": fresh_number}, headers=auth(tokens["contact1"]))
    assert report.status_code == 201

    after = analyze(client, tokens["requester"], "req_after_report", "hello", caller_phone_number=fresh_number)
    assert "reported_scam_number" in after.json()["reason_codes"]


def test_scam_reports_require_authentication(client):
    r = client.post("/scam-reports", json={"phone_number": "+919000000000"})
    assert r.status_code == 401


def test_scam_report_rejects_a_number_with_no_digits(client, tokens):
    r = client.post("/scam-reports", json={"phone_number": "not-a-number"}, headers=auth(tokens["requester"]))
    assert r.status_code == 422


def test_scam_report_rejects_unknown_request_id(client, tokens):
    r = client.post("/scam-reports", json={
        "phone_number": "+919000000000", "request_id": "req_does_not_exist",
    }, headers=auth(tokens["requester"]))
    assert r.status_code == 404
