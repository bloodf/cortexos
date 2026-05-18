"""FastAPI entrypoint for the cortex-graph sidecar.

Endpoints:
  POST /graph/runs                  start a run
  POST /graph/runs/{thread_id}/resume   resume a paused run
  GET  /graph/runs/{thread_id}/state    inspect persisted state
  GET  /healthz                     liveness probe
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import JSONResponse

from app.auth import require_bearer
from app.config import get_settings
from app.graph import checkpointer_lifespan
from app.nats_bridge import NatsBridge
from app.runner import RunOrchestrator
from app.state import ResumeRequest, RunRequest, RunResponse, StateSnapshot
from app.telemetry import instrument as instrument_telemetry

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Compose checkpointer + bridge + orchestrator for the app lifetime."""
    # V8 — OpenLLMetry + Langfuse bootstrap. No-op when LANGFUSE_HOST is unset.
    instrument_telemetry(service="cortex-graph")
    async with checkpointer_lifespan() as checkpointer:
        bridge: NatsBridge | None = None
        orchestrator = RunOrchestrator(checkpointer)

        async def _on_invoke(payload: dict) -> None:
            await orchestrator.start(
                role=str(payload.get("role", "unknown")),
                issue_id=str(payload.get("issueId", "unknown")),
                payload=payload.get("input", {}) or {},
                thread_id=payload.get("threadId"),
            )

        if get_settings().nats_enabled:
            bridge = NatsBridge(_on_invoke)
            await bridge.connect()
            orchestrator = RunOrchestrator(checkpointer, bridge)
        app.state.orchestrator = orchestrator
        app.state.bridge = bridge
        try:
            yield
        finally:
            if bridge is not None:
                await bridge.close()


def create_app() -> FastAPI:
    app = FastAPI(title="cortex-graph", version="0.1.0", lifespan=lifespan)

    @app.get("/healthz")
    async def healthz() -> JSONResponse:
        return JSONResponse({"status": "ok"})

    @app.post("/graph/runs", response_model=RunResponse, dependencies=[Depends(require_bearer)])
    async def start_run(body: RunRequest) -> RunResponse:
        orchestrator: RunOrchestrator = app.state.orchestrator
        return await orchestrator.start(
            role=body.role,
            issue_id=body.issueId,
            payload=body.input,
            thread_id=body.threadId,
        )

    @app.post(
        "/graph/runs/{thread_id}/resume",
        response_model=RunResponse,
        dependencies=[Depends(require_bearer)],
    )
    async def resume_run(thread_id: str, body: ResumeRequest) -> RunResponse:
        orchestrator: RunOrchestrator = app.state.orchestrator
        try:
            return await orchestrator.resume(
                thread_id=thread_id,
                decision=body.decision,
                override=body.override,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="thread_not_found") from exc

    @app.get(
        "/graph/runs/{thread_id}/state",
        response_model=StateSnapshot,
        dependencies=[Depends(require_bearer)],
    )
    async def get_state(thread_id: str) -> StateSnapshot:
        orchestrator: RunOrchestrator = app.state.orchestrator
        return await orchestrator.get_state(thread_id=thread_id)

    return app


app = create_app()
