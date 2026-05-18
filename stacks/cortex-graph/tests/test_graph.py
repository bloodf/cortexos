"""End-to-end graph drive against the in-memory checkpointer."""

from __future__ import annotations

import pytest
from langgraph.checkpoint.memory import MemorySaver

from app.runner import RunOrchestrator


@pytest.mark.asyncio
async def test_start_interrupts_before_human_review():
    orch = RunOrchestrator(MemorySaver())
    resp = await orch.start(role="PM", issue_id="issue-1", payload={"title": "draft"})
    assert resp.status == "interrupted"
    assert resp.nodeId == "human_review"
    snap = await orch.get_state(thread_id=resp.threadId)
    assert snap.values["phase"] == "executed"
    assert snap.next == ["human_review"]


@pytest.mark.asyncio
async def test_resume_approves_and_completes():
    orch = RunOrchestrator(MemorySaver())
    start = await orch.start(role="QA", issue_id="issue-2", payload={"title": "verify"})
    resume = await orch.resume(thread_id=start.threadId, decision="approved")
    assert resume.status == "completed"
    snap = await orch.get_state(thread_id=start.threadId)
    assert snap.values["phase"] == "verified"
    assert snap.values["verified"] is True


@pytest.mark.asyncio
async def test_resume_rejected_fails_verifier():
    orch = RunOrchestrator(MemorySaver())
    start = await orch.start(role="QA", issue_id="issue-3", payload={})
    resume = await orch.resume(thread_id=start.threadId, decision="rejected")
    # human_review returns verified=False which the verifier then keeps as failed.
    assert resume.status == "failed"


@pytest.mark.asyncio
async def test_get_state_unknown_thread():
    orch = RunOrchestrator(MemorySaver())
    snap = await orch.get_state(thread_id="thread_does_not_exist")
    assert snap.threadId == "thread_does_not_exist"
    assert snap.state == "unknown"
