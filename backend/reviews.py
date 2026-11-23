import json
import sqlite3
from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from backend.database import connect, evidence
from backend.evidence import Handler, encode, read_records
from backend.policy import Action, Decision, Reason, expected


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    handler_id: str
    version: int = Field(ge=0, strict=True)


class Submission(ReviewRequest):
    action: Action
    rationale: Reason


class SupervisorReview(ReviewRequest):
    outcome: Literal["approve", "return_for_revision"]
    note: Reason


def find_case(db: sqlite3.Connection, case_id: str) -> sqlite3.Row:
    row = db.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Case not found")
    return row


def detail(row: sqlite3.Row):
    return {
        "case_id": row["case_id"],
        "status": row["status"],
        "version": row["version"],
        "evidence": evidence(row),
        "recommendation": json.loads(row["recommendation"] or "null"),
        "history": json.loads(row["history"]),
    }


def record(case_id: str, request: Submission | SupervisorReview):
    handler = next(
        (
            entry
            for entry in read_records("handlers.json", Handler)
            if entry.handler_id == request.handler_id
        ),
        None,
    )
    if handler is None:
        raise HTTPException(404, "Staff member not found")
    supervisor = isinstance(request, SupervisorReview)
    if handler.role != ("supervisor" if supervisor else "support_agent"):
        raise HTTPException(403, "This staff role cannot perform the requested action.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        row = find_case(db, case_id)
        if (
            row["status"] != ("awaiting_supervisor" if supervisor else "waiting")
            or row["version"] != request.version
        ):
            raise HTTPException(409, "Case changed. Reload it before submitting again.")
        history = json.loads(row["history"])
        entry = {
            "handler_id": handler.handler_id,
            "display_name": handler.display_name,
            "recorded_at": datetime.now(UTC).isoformat(),
        }
        if isinstance(request, SupervisorReview):
            status = "decided" if request.outcome == "approve" else "waiting"
            history.append(
                {
                    **entry,
                    "kind": "supervisor",
                    "outcome": request.outcome,
                    "note": request.note,
                }
            )
        else:
            try:
                action, amount, requires_review, ref = expected(evidence(row))
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
            if request.action != action:
                raise HTTPException(422, f"{ref} requires {action} for this evidence.")
            decision = Decision(
                action=action,
                refund_sar=float(amount),
                requires_review=requires_review,
                policy_ref=ref,
                rationale=request.rationale,
            )
            status = "awaiting_supervisor" if requires_review else "decided"
            history.append(
                {**entry, "kind": "submission", "decision": decision.model_dump()}
            )
        db.execute(
            "UPDATE cases SET status = ?, history = ?, version = version + 1 WHERE case_id = ?",
            (status, encode(history), case_id),
        )
        return detail(find_case(db, case_id))
