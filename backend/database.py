import os
import sqlite3
from collections.abc import Iterator
from contextlib import closing, contextmanager
from pathlib import Path

from backend.evidence import DATA, ROOT, Evidence, load_queue


@contextmanager
def connect(path: Path | None = None) -> Iterator[sqlite3.Connection]:
    database = path or Path(os.environ.get("DELIVERY_DB", ROOT / "delivery.sqlite3"))
    with closing(sqlite3.connect(database)) as connection, connection:
        connection.row_factory = sqlite3.Row
        yield connection


def seed(path: Path | None = None, data: Path = DATA) -> None:
    cases = load_queue(data)
    with connect(path) as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS cases (
                case_id TEXT PRIMARY KEY,
                evidence TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'waiting',
                version INTEGER NOT NULL DEFAULT 0,
                recommendation TEXT,
                history TEXT NOT NULL DEFAULT '[]'
            )
        """)
        db.executemany(
            "INSERT INTO cases (case_id, evidence) VALUES (?, ?) ON CONFLICT(case_id) DO NOTHING",
            [(case.ticket.case_id, case.model_dump_json()) for case in cases],
        )


def evidence(row: sqlite3.Row) -> Evidence:
    return Evidence.model_validate_json(row["evidence"])
