import os
from tempfile import TemporaryDirectory

from backend.evidence import Evidence
from backend.main import app, recommendation_provider
from backend.policy import Decision, expected

database = TemporaryDirectory(prefix="delivery-pilot-")
os.environ["DELIVERY_DB"] = os.path.join(database.name, "pilot.sqlite3")


def fixture_recommendation(case: Evidence) -> Decision:
    if case.ticket.case_id == "DED-2002":
        raise ValueError("Simulated provider failure")
    action, amount, review, ref = expected(case)
    if case.ticket.case_id == "DED-2001":
        rationale = "تم تسجيل التسليم قبل أقل من ٢٤ ساعة ولا يوجد إثبات متعارض."
    elif case.ticket.case_id in {"DED-2004", "DED-2016"}:
        rationale = "The carrier confirmed return_received."
    else:
        rationale = "The carrier confirmed receipt at the retailer warehouse."
    return Decision(
        action=action,
        refund_sar=float(amount),
        requires_review=review,
        policy_ref=ref,
        rationale=rationale,
    )


app.dependency_overrides[recommendation_provider] = lambda: fixture_recommendation
