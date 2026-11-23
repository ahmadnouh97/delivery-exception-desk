import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from groq import APIError

from backend.database import connect, evidence, seed
from backend.evidence import Handler, read_records
from backend.policy import Decision, expected
from backend.recommendations import Provider, recommend
from backend.reviews import Submission, SupervisorReview, detail, find_case, record


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    seed()
    yield


app = FastAPI(title="Delivery Exception Desk", lifespan=lifespan)


@app.get("/api/health", operation_id="health")
def health() -> dict[str, str]:
    """Report that the API is running."""
    return {"status": "ok"}


@app.get("/api/cases")
def list_cases():
    with connect() as db:
        rows = db.execute("SELECT * FROM cases ORDER BY case_id").fetchall()
    return [
        {
            "case_id": row["case_id"],
            "status": row["status"],
            "language": case.ticket.language,
            "exception_type": case.ticket.exception_type,
            "item": case.order.item,
            "order_id": case.order.order_id,
            "tracking_id": case.shipment.tracking_id,
        }
        for row in rows
        for case in [evidence(row)]
    ]


@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    with connect() as db:
        return detail(find_case(db, case_id))


@app.get("/api/handlers")
def list_handlers() -> list[Handler]:
    return read_records("handlers.json", Handler)


def recommendation_provider() -> Provider:
    return recommend


@app.post("/api/cases/{case_id}/recommendation")
def generate(
    case_id: str, provider: Annotated[Provider, Depends(recommendation_provider)]
) -> Decision:
    with connect() as db:
        row = find_case(db, case_id)
    if row["status"] != "waiting":
        raise HTTPException(409, "Case is no longer waiting for a decision.")
    if row["recommendation"] is not None:
        return Decision.model_validate_json(row["recommendation"])
    case = evidence(row)
    try:
        fields = expected(case)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    try:
        result = provider(case)
    except (APIError, ValueError) as error:
        raise HTTPException(
            503, "Recommendation unavailable. Retry or record a manual decision."
        ) from error
    if result.fields() != fields:
        raise HTTPException(
            502, "Recommendation conflicts with policy. Record a manual decision."
        )
    with connect() as db:
        saved: sqlite3.Row | None = db.execute(
            """UPDATE cases SET recommendation = ?, version = version + 1
               WHERE case_id = ? AND version = ? AND status = 'waiting' AND recommendation IS NULL
               RETURNING recommendation""",
            (result.model_dump_json(), case_id, row["version"]),
        ).fetchone()
        current = saved or find_case(db, case_id)
        if saved is None and (
            current["status"] != "waiting"
            or current["recommendation"] is None
            or current["version"] != row["version"] + 1
        ):
            raise HTTPException(
                409, "Case changed while generating the recommendation."
            )
        return Decision.model_validate_json(current["recommendation"])


@app.post("/api/cases/{case_id}/decision")
def submit_decision(case_id: str, request: Submission):
    return record(case_id, request)


@app.post("/api/cases/{case_id}/supervisor-review")
def supervisor_review(case_id: str, request: SupervisorReview):
    return record(case_id, request)
