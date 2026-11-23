from fastapi.testclient import TestClient

from backend.database import seed


def test_reviews(client: TestClient):
    ordinary = "/api/cases/DED-2003"
    refund = {
        "action": "refund",
        "rationale": "Warehouse receipt confirmed.",
        "handler_id": "DED-H001",
        "version": 0,
    }
    decision = client.post(ordinary + "/decision", json=refund)
    assert decision.json()["history"][0]["decision"]["refund_sar"] == 490
    assert decision.json()["status"] == "decided"
    assert client.post(ordinary + "/decision", json=refund).status_code == 409

    held = "/api/cases/DED-2008"
    submission = {**refund, "action": "replace"}
    assert client.post(held + "/decision", json=refund).status_code == 422
    assert (
        client.post(held + "/decision", json=submission).json()["status"]
        == "awaiting_supervisor"
    )
    review = {
        "handler_id": "DED-H001",
        "outcome": "return_for_revision",
        "version": 1,
        "note": "Cite stock confirmation.",
    }
    assert client.post(held + "/supervisor-review", json=review).status_code == 403
    review["handler_id"] = "DED-H003"
    assert (
        client.post(held + "/supervisor-review", json=review).json()["status"]
        == "waiting"
    )
    submission.update(version=2, rationale="Warehouse receipt and stock confirmed.")
    assert client.post(held + "/decision", json=submission).status_code == 200
    review.update(version=3, outcome="approve")
    final = client.post(held + "/supervisor-review", json=review).json()
    assert final["status"] == "decided"
    assert final["history"][1]["note"] == "Cite stock confirmation."
    assert final["history"][-1]["recorded_at"]
    seed()
    assert client.get(held).json() == final
