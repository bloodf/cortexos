"""FastAPI surface — auth + run lifecycle via TestClient.

These tests bypass the real lifespan (which would try to connect to NATS) by
manually wiring an orchestrator backed by `MemorySaver` and disabling the NATS
bridge through the env var set in `conftest.py`.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import MemorySaver

from app.main import create_app
from app.runner import RunOrchestrator


@pytest.fixture
def client() -> Iterator[TestClient]:
    app: FastAPI = create_app()
    # Skip the lifespan entirely: bind a deterministic orchestrator.
    app.state.orchestrator = RunOrchestrator(MemorySaver())
    app.state.bridge = None
    with TestClient(app) as c:
        yield c


def test_healthz_open(client: TestClient):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_runs_requires_bearer(client: TestClient):
    r = client.post("/graph/runs", json={"role": "PM", "issueId": "i1"})
    assert r.status_code == 401


def test_runs_rejects_bad_bearer(client: TestClient):
    r = client.post(
        "/graph/runs",
        json={"role": "PM", "issueId": "i1"},
        headers={"Authorization": "Bearer wrong"},
    )
    assert r.status_code == 401


def test_full_run_lifecycle(client: TestClient):
    headers = {"Authorization": "Bearer test-token"}
    start = client.post(
        "/graph/runs",
        json={"role": "PM", "issueId": "i1", "input": {"title": "go"}},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    body = start.json()
    assert body["status"] == "interrupted"
    thread_id = body["threadId"]

    state = client.get(f"/graph/runs/{thread_id}/state", headers=headers)
    assert state.status_code == 200
    assert state.json()["state"] == "executed"

    resume = client.post(
        f"/graph/runs/{thread_id}/resume",
        json={"decision": "approved"},
        headers=headers,
    )
    assert resume.status_code == 200
    assert resume.json()["status"] == "completed"


def test_resume_invalid_decision(client: TestClient):
    headers = {"Authorization": "Bearer test-token"}
    start = client.post(
        "/graph/runs",
        json={"role": "PM", "issueId": "i1"},
        headers=headers,
    )
    thread_id = start.json()["threadId"]
    bad = client.post(
        f"/graph/runs/{thread_id}/resume",
        json={"decision": "maybe"},
        headers=headers,
    )
    assert bad.status_code == 422
