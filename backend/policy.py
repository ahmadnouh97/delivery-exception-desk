from datetime import timedelta
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StringConstraints

from backend.evidence import DATA, Evidence

Action = Literal[
    "no_action",
    "wait_for_update",
    "open_carrier_investigation",
    "request_information",
    "replace",
    "refund",
]
PolicyRef = Literal["P1", "P2", "P3", "P4", "P5"]
Reason = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)
]


class Settings(BaseModel):
    missing_delivery_wait_hours: int
    supervisor_review_threshold_sar: Decimal


settings = Settings.model_validate_json((DATA / "company.json").read_bytes())


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    action: Action
    refund_sar: float = Field(ge=0)
    requires_review: StrictBool
    policy_ref: PolicyRef
    rationale: Reason

    def fields(self) -> tuple[Action, Decimal, bool, PolicyRef]:
        return (
            self.action,
            Decimal(str(self.refund_sar)),
            self.requires_review,
            self.policy_ref,
        )


def expected(case: Evidence) -> tuple[Action, Decimal, bool, PolicyRef]:
    order = case.order
    zero = Decimal(0)
    if any(entry.status == "completed" and entry.same_issue for entry in case.history):
        return "no_action", zero, False, "P1"
    if case.ticket.exception_type == "delivered_not_received":
        proof = case.shipment.proof_of_delivery
        if proof is not None and proof.assessment == "mismatch":
            return "open_carrier_investigation", zero, False, "P2"
        latest = max(
            (event.at for event in case.shipment.events if event.status == "delivered"),
            default=None,
        )
        if latest is None:
            raise ValueError(
                "No delivered scan was available when the case was reported."
            )
        if case.ticket.reported_at - latest >= timedelta(
            hours=settings.missing_delivery_wait_hours
        ):
            return "open_carrier_investigation", zero, False, "P2"
        return "wait_for_update", zero, False, "P2"
    if not any(event.status == "return_received" for event in case.shipment.events):
        return "wait_for_update", zero, False, "P3"
    review = order.total_sar > settings.supervisor_review_threshold_sar
    ref: PolicyRef = "P5" if review else "P4"
    if case.ticket.requested_refund_sar is not None or not order.replacement_in_stock:
        return "refund", order.total_sar, review, ref
    if order.replacement_address_status == "needs_confirmation":
        return "request_information", zero, False, "P4"
    return "replace", zero, review, ref
