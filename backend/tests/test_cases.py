import json
from datetime import timedelta
from pathlib import Path
from shutil import copyfile

import pytest
from fastapi.testclient import TestClient

from backend.database import connect, seed
from backend.evidence import DATA, CarrierEvent, Proof, load_queue, snapshot


def test_seeded_cases(client: TestClient):
    queue = client.get("/api/cases").json()
    assert len(queue) == 24
    assert all(case["status"] == "waiting" for case in queue)
    assert client.get("/api/cases/unknown").status_code == 404
    case = client.get("/api/cases/DED-2001").json()
    summary = next(row for row in queue if row["case_id"] == case["case_id"])
    assert summary["order_id"] == case["evidence"]["order"]["order_id"]
    assert summary["tracking_id"] == case["evidence"]["shipment"]["tracking_id"]
    assert "جاني" in case["evidence"]["ticket"]["customer_message"]
    assert case["evidence"]["shipment"]["proof_of_delivery"] is None
    assert "difficulty" not in str(case)
    assert client.get("/api/cases/DED-2009").json()["evidence"]["history"][0][
        "same_issue"
    ]
    assert len(client.get("/api/handlers").json()) == 3


def test_reseed_preserves_saved_state(tmp_path: Path):
    path = tmp_path / "pilot.sqlite3"
    seed(path)
    with connect(path) as db:
        db.execute(
            "UPDATE cases SET status = 'decided', version = 1 WHERE case_id = 'DED-2001'"
        )
    seed(path)
    with connect(path) as db:
        assert db.execute("SELECT count(*) FROM cases").fetchone()[0] == 24
        assert tuple(
            db.execute(
                "SELECT status, version FROM cases WHERE case_id = 'DED-2001'"
            ).fetchone()
        ) == ("decided", 1)


def test_report_time_boundary():
    case = load_queue()[0]
    cutoff = case.ticket.reported_at
    last = CarrierEvent(at=cutoff, status="delivered", detail="At report time")
    future = last.model_copy(update={"at": cutoff + timedelta(seconds=1)})
    case.shipment.events += [future, last]
    case.shipment.proof_of_delivery = Proof(
        kind="photo", assessment="mismatch", detail="From the later scan"
    )
    replay = snapshot(case.ticket, case.order, case.shipment, case.history)
    assert replay.shipment.events[-1] == last
    assert replay.shipment.proof_of_delivery is None
    wrong = case.shipment.model_copy(update={"tracking_id": "invalid"})
    with pytest.raises(ValueError, match="Mismatched order or shipment"):
        snapshot(case.ticket, case.order, wrong, [])


def test_invalid_fixture_prevents_seed(tmp_path: Path):
    for name in ("orders.json", "shipments.json", "prior_resolutions.json"):
        copyfile(DATA / name, tmp_path / name)
    cases = json.loads((DATA / "cases.json").read_text(encoding="utf-8"))
    cases[-1]["tracking_id"] = cases[0]["tracking_id"]
    (tmp_path / "cases.json").write_text(json.dumps(cases), encoding="utf-8")
    path = tmp_path / "pilot.sqlite3"
    with pytest.raises(ValueError, match="Invalid fixture references"):
        seed(path, tmp_path)
    assert not path.exists()
