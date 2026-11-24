import asyncio
import logging
import math
import os
import sqlite3
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from email.utils import parsedate_to_datetime
from threading import TIMEOUT_MAX, Event, Lock
from time import monotonic, time
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from groq import APIError, APIStatusError

from backend.database import connect, evidence, seed
from backend.evidence import Handler, read_records
from backend.policy import Decision, expected
from backend.recommendations import Provider, recommend
from backend.reviews import Submission, SupervisorReview, detail, find_case, record

case_locks: dict[str, Lock] = {}
cooldown_lock = Lock()
cooldown_until = 0.0
logger = logging.getLogger(__name__)
MAX_BACKGROUND_ATTEMPTS = 3


def retry_delay(header: str | None) -> int:
    if header:
        try:
            seconds = float(header)
        except ValueError:
            try:
                seconds = parsedate_to_datetime(header).timestamp() - time()
            except (ValueError, TypeError, OverflowError, OSError):
                return 60
        if math.isfinite(seconds):
            return max(1, math.ceil(seconds))
    return 60


def check_cooldown(extend_by: int = 0, *, cause: APIStatusError | None = None) -> None:
    global cooldown_until
    with cooldown_lock:
        now = monotonic()
        if extend_by:
            cooldown_until = max(cooldown_until, now + extend_by)
        remaining = math.ceil(cooldown_until - now)
    if remaining > 0:
        raise HTTPException(
            429,
            f"Recommendation rate-limited. Retry in {remaining} seconds.",
            headers={"Retry-After": str(remaining)},
        ) from cause


def prepare_queue(stop: Event, provider: Provider) -> None:
    with connect() as db:
        rows = db.execute(
            "SELECT case_id FROM cases WHERE status = 'waiting' AND recommendation IS NULL ORDER BY case_id"
        ).fetchall()
    for row in rows:
        failures = 0
        while not stop.is_set():
            try:
                generate(row["case_id"], provider)
                break
            except HTTPException as error:
                if error.status_code == 429 and error.headers:
                    delay = int(error.headers["Retry-After"])
                    if isinstance(error.__cause__, APIStatusError):
                        failures += 1
                        if failures >= MAX_BACKGROUND_ATTEMPTS:
                            logger.warning(
                                "Deferred %s after %s rate-limited attempts",
                                row["case_id"],
                                failures,
                            )
                            break
                        delay *= 2 ** (failures - 1)
                    if stop.wait(min(TIMEOUT_MAX, delay)):
                        return
                    continue
                logger.info("Skipped %s (HTTP %s)", row["case_id"], error.status_code)
                break
        else:
            return


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    seed()
    if os.environ.get("DELIVERY_PREPARE_QUEUE") == "0":
        yield
        return
    stop = Event()
    factory = application.dependency_overrides.get(
        recommendation_provider, recommendation_provider
    )
    worker = asyncio.create_task(asyncio.to_thread(prepare_queue, stop, factory()))
    try:
        yield
    finally:
        stop.set()
        await worker


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
    with case_locks.setdefault(row["case_id"], Lock()):
        return prepare_case(case_id, provider)


def prepare_case(case_id: str, provider: Provider) -> Decision:
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
    check_cooldown()
    try:
        result = provider(case)
    except (APIError, ValueError) as error:
        status = error.status_code if isinstance(error, APIStatusError) else None
        retry_after = (
            error.response.headers.get("retry-after")
            if isinstance(error, APIStatusError)
            else None
        )
        logger.warning(
            "Recommendation failed case=%s exception=%s upstream_status=%s retry_after=%r",
            case_id,
            type(error).__name__,
            status,
            retry_after,
        )
        if isinstance(error, APIStatusError) and status == 429:
            check_cooldown(retry_delay(retry_after), cause=error)
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
