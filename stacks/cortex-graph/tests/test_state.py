"""Pydantic state model coverage."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.state import GraphRunState, NodeStatus, ResumeRequest, RunRequest


def test_graph_run_state_accepts_valid():
    s = GraphRunState(runId="r1", nodeName="planner", status=NodeStatus.running)
    assert s.runId == "r1"
    assert s.status == NodeStatus.running
    # ts is auto-populated; output defaults to empty dict; error defaults None.
    assert s.ts
    assert s.output == {}
    assert s.error is None


def test_graph_run_state_rejects_empty_run():
    with pytest.raises(ValidationError):
        GraphRunState(runId="", nodeName="planner", status=NodeStatus.running)


def test_graph_run_state_rejects_unknown_status():
    with pytest.raises(ValidationError):
        GraphRunState(runId="r", nodeName="n", status="not-real")  # type: ignore[arg-type]


def test_graph_run_state_is_frozen():
    s = GraphRunState(runId="r1", nodeName="planner", status=NodeStatus.running)
    with pytest.raises(ValidationError):
        s.runId = "r2"  # type: ignore[misc]


def test_run_request_forbids_extra():
    with pytest.raises(ValidationError):
        RunRequest(role="r", issueId="i", input={}, evil="x")  # type: ignore[call-arg]


def test_resume_request_pattern():
    ResumeRequest(decision="approved")
    ResumeRequest(decision="rejected", note="nope")
    with pytest.raises(ValidationError):
        ResumeRequest(decision="maybe")
