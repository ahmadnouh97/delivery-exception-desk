from datetime import timedelta
from decimal import Decimal

import pytest

from backend.evidence import load_queue
from backend.policy import expected


@pytest.mark.parametrize(
    ("case_id", "action", "amount", "review", "ref"),
    [
        ("DED-2001", "wait_for_update", "0", False, "P2"),
        ("DED-2002", "open_carrier_investigation", "0", False, "P2"),
        ("DED-2003", "refund", "490", False, "P4"),
        ("DED-2008", "replace", "0", True, "P5"),
        ("DED-2009", "no_action", "0", False, "P1"),
    ],
)
def test_policy(case_id: str, action: str, amount: str, review: bool, ref: str):
    case = next(case for case in load_queue() if case.ticket.case_id == case_id)
    assert expected(case) == (action, Decimal(amount), review, ref)


def test_exact_wait_boundary():
    case = load_queue()[0]
    case.ticket.reported_at = case.shipment.events[-1].at + timedelta(hours=24)
    assert expected(case)[0] == "open_carrier_investigation"


@pytest.mark.parametrize("case_index", [2, 7])
@pytest.mark.parametrize(("amount", "review"), [("500.00", False), ("500.01", True)])
def test_supervisor_boundary(case_index: int, amount: str, review: bool):
    case = load_queue()[case_index]
    case.order.total_sar = Decimal(amount)
    assert expected(case)[2:] == (review, "P5" if review else "P4")


def test_pending_and_unrelated_resolutions_do_not_override_p2():
    case = load_queue()[8]
    entry = case.history[0]
    entry.status = "pending"
    assert expected(case)[0] == "open_carrier_investigation"
    entry.status = "completed"
    entry.same_issue = False
    assert expected(case)[0] == "open_carrier_investigation"


def test_depot_and_warehouse_are_different():
    case = load_queue()[7]
    receipt = next(
        scan for scan in case.shipment.events if scan.status == "return_received"
    )
    receipt.status = "return_at_carrier_depot"
    assert expected(case)[0] == "wait_for_update"
    receipt.status = "return_received"
    case.order.replacement_address_status = "needs_confirmation"
    assert expected(case)[0] == "request_information"
    case.order.replacement_in_stock = False
    assert expected(case)[0] == "refund"
