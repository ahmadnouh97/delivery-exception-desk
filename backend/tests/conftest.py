from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DELIVERY_PREPARE_QUEUE", "0")
    monkeypatch.setenv("DELIVERY_DB", str(tmp_path / "pilot.sqlite3"))
    with TestClient(app) as session:
        yield session
