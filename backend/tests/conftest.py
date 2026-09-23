import os
import tempfile

# Must be set before app.firebase_auth is imported (it reads this env var
# once at module import time), so tests can exercise POST /auth/login via
# the clearly-labeled dev-mode token path without real Firebase credentials.
os.environ.setdefault("SAFESIGNAL_AUTH_DEV_MODE", "true")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import database
import app.main as main


@pytest.fixture()
def client():
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)

    test_engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # database.engine/SessionLocal are read dynamically (not captured via a
    # stale `from ... import` binding) by main.py's startup hook and by
    # get_db(), so reassigning these module attributes is enough to point
    # a fresh app instance at an isolated temp-file DB per test -- no
    # module reloading required, which avoids the classic "two different
    # SQLAlchemy Base/metadata objects" trap that reloading app.database
    # would otherwise cause.
    database.engine = test_engine
    database.SessionLocal = TestSessionLocal

    with TestClient(main.app) as c:
        yield c

    os.unlink(db_path)


@pytest.fixture()
def tokens():
    return {
        "requester": "demo-requester-token-user102",
        "contact1": "demo-contact-token-contact101",
        "contact2": "demo-contact-token-contact202",
    }


def auth(token):
    return {"Authorization": f"Bearer {token}"}
