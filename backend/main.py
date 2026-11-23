from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from backend.database import connect, evidence, seed
from backend.evidence import Handler, read_records


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
        }
        for row in rows
        for case in [evidence(row)]
    ]


@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    with connect() as db:
        row = db.execute("SELECT * FROM cases WHERE case_id = ?", (case_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Case not found")
    return {
        "case_id": case_id,
        "status": row["status"],
        "version": row["version"],
        "evidence": evidence(row),
    }


@app.get("/api/handlers")
def list_handlers() -> list[Handler]:
    return read_records("handlers.json", Handler)
