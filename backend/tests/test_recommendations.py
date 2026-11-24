import json
from threading import Event
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from backend.evidence import Evidence
from backend.main import app, prepare_queue, recommendation_provider
from backend.policy import Decision, expected
from backend.recommendations import recommend
from labs.evaluate_pilot import load_cases


@pytest.mark.parametrize("with_tools", [False, True])
@pytest.mark.parametrize(
    ("case_id", "seconds", "proof", "elapsed", "above_threshold"),
    [
        ("DED-1006", 86340, "inconclusive", False, False),
        ("DED-1031", 1620, "unavailable", False, False),
        ("DED-4003", 102180, "inconclusive", True, False),
        ("DED-4005", None, "unavailable", None, True),
    ],
)
def test_november_policy_facts(
    case_id, seconds, proof, elapsed, above_threshold, with_tools
):
    _, case, label = next(
        row for row in load_cases() if row[1].ticket.case_id == case_id
    )
    model = Mock()
    model.bind_tools.return_value.invoke.side_effect = [
        Mock(tool_calls=[{"name": name, "args": {"case_id": case_id}}])
        for name in ("order_and_shipment", "resolution_history")
    ]
    labeled_decision = Decision(
        **{
            key: label[key]
            for key in ("action", "refund_sar", "requires_review", "policy_ref")
        },
        rationale="Fixture decision.",
    )
    final_request = model.with_structured_output.return_value.invoke
    final_request.return_value = labeled_decision
    recommend(case, model, with_tools=with_tools)
    _, human = final_request.call_args.args[0]
    evidence = json.loads(human[1])["evidence"]
    assert evidence["seconds_since_delivery"] == seconds
    assert evidence["policy_facts"] == {
        "completed_same_issue_resolution": False,
        "proof_assessment": proof,
        "delivery_wait_elapsed": elapsed,
        "order_above_review_threshold": above_threshold,
    }
    assert expected(case) == labeled_decision.fields()


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
