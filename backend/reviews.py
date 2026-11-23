import json
import sqlite3

from fastapi import HTTPException

from backend.database import evidence


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
