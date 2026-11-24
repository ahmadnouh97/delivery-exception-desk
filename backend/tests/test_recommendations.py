from threading import Event

from fastapi.testclient import TestClient

from backend.evidence import Evidence
from backend.main import app, prepare_queue, recommendation_provider
from backend.policy import Decision


def test_recommendation_and_manual_fallback(client: TestClient):
    def provider(case: Evidence) -> Decision:
        assert case.ticket.case_id in {"DED-2001", "DED-2002"}
        assert all(scan.at <= case.ticket.reported_at for scan in case.shipment.events)
        return Decision(
            action="wait_for_update",
            refund_sar=0,
            requires_review=False,
            policy_ref="P2",
            rationale="The delivered scan is less than 24 hours old.",
        )

    app.dependency_overrides[recommendation_provider] = lambda: provider
    try:
        route = "/api/cases/DED-2001"
        response = client.post(route + "/recommendation")
        assert response.status_code == 200
        assert client.post(route + "/recommendation").json() == response.json()
        case = client.get(route).json()
        assert (
            case["version"] == 1 and case["status"] == "waiting" and not case["history"]
        )
        invalid = "/api/cases/DED-2002"
        assert client.post(invalid + "/recommendation").status_code == 502
        assert client.get(invalid).json()["recommendation"] is None
    finally:
        app.dependency_overrides.clear()


def test_late_recommendation_cannot_replace_manual_decision(client: TestClient):
    route = "/api/cases/DED-2001"

    def provider(_: Evidence) -> Decision:
        result = client.post(
            route + "/decision",
            json={
                "handler_id": "DED-H001",
                "version": 0,
                "action": "wait_for_update",
                "rationale": "The delivered scan is less than 24 hours old.",
            },
        )
        assert result.status_code == 200
        return Decision(
            action="wait_for_update",
            refund_sar=0,
            requires_review=False,
            policy_ref="P2",
            rationale="Generated after the manual decision.",
        )

    app.dependency_overrides[recommendation_provider] = lambda: provider
    try:
        assert client.post(route + "/recommendation").status_code == 409
        case = client.get(route).json()
        assert case["status"] == "decided"
        assert case["recommendation"] is None
        assert len(case["history"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_queue_prepares_and_reuses_valid_recommendations(client: TestClient):
    from backend.policy import expected

    attempts: list[str] = []

    def provider(case: Evidence) -> Decision:
        attempts.append(case.ticket.case_id)
        if case.ticket.case_id == "DED-2002":
            raise ValueError("unavailable")
        action, amount, review, policy = expected(case)
        return Decision(
            action=action,
            refund_sar=float(amount),
            requires_review=review,
            policy_ref=policy,
            rationale="Based on the report-time evidence.",
        )

    prepare_queue(Event(), provider)
    cases = client.get("/api/cases").json()
    assert len(attempts) == len(cases) == 24
    for entry in cases:
        case = client.get("/api/cases/" + entry["case_id"]).json()
        assert bool(case["recommendation"]) == (case["case_id"] != "DED-2002")
        assert case["status"] == "waiting" and not case["history"]
    attempts.clear()
    prepare_queue(Event(), provider)
    assert attempts == ["DED-2002"]
