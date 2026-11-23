from fastapi.testclient import TestClient

from backend.evidence import Evidence
from backend.main import app, recommendation_provider
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
