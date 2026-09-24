import asyncio
import logging

from fastapi import FastAPI, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.config import CORS_ORIGINS
from app import database
from app.database import Base
from app.routers import analyze, verify, requests as requests_router, contacts, health, demo, auth, panic, scam_reports
from app.seed import seed_demo_data
from app.verification_service import sweep_timeouts

logger = logging.getLogger("safesignal")

app = FastAPI(title="SafeSignal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analyze.router)
app.include_router(verify.router)
app.include_router(requests_router.router)
app.include_router(contacts.router)
app.include_router(demo.router)
app.include_router(auth.router)
app.include_router(panic.router)
app.include_router(scam_reports.router)

_sweeper_task: asyncio.Task | None = None


async def _sweeper_loop():
    while True:
        try:
            db = database.SessionLocal()
            try:
                await sweep_timeouts(db)
            finally:
                db.close()
        except Exception:
            logger.exception("timeout sweeper failed")
        await asyncio.sleep(2)


@app.on_event("startup")
async def on_startup():
    # Read database.engine/SessionLocal dynamically (not via a top-level
    # `from app.database import engine`) so tests can swap in a temp-file
    # engine per test by reassigning the module attributes before the ASGI
    # lifespan runs, without needing to reload any modules.
    Base.metadata.create_all(bind=database.engine)
    db = database.SessionLocal()
    try:
        seed_demo_data(db)
    finally:
        db.close()
    global _sweeper_task
    _sweeper_task = asyncio.create_task(_sweeper_loop())


@app.on_event("shutdown")
async def on_shutdown():
    if _sweeper_task:
        _sweeper_task.cancel()


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: FastAPIRequest, exc: IntegrityError):
    # Defense in depth for the acceptance checklist's FK requirement: any
    # write that violates a foreign key or uniqueness constraint (e.g. a
    # requester_id that doesn't resolve to a real users row) comes back as
    # a clean 409, never a raw 500.
    logger.warning("IntegrityError: %s", exc)
    return JSONResponse(status_code=409, content={"error": {
        "code": "INTEGRITY_ERROR",
        "message": "This request conflicts with an existing record or references a user that doesn't exist.",
    }})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: FastAPIRequest, exc: Exception):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": str(exc)}})
