"""Per-node behavior — deterministic, no model backend."""

from __future__ import annotations

import pytest

from app.nodes import executor, human_review, planner, verifier


@pytest.mark.asyncio
async def test_planner_emits_role_and_phase():
    out = await planner.run({"role": "QA", "input": {"title": "x"}})
    assert out["phase"] == "planned"
    assert out["plan"][0]["step"] == "intake"
    assert out["plan"][-1]["role"] == "QA"


@pytest.mark.asyncio
async def test_planner_without_title():
    out = await planner.run({"role": "PM", "input": {}})
    assert all(s.get("step") != "intake" for s in out["plan"])


@pytest.mark.asyncio
async def test_executor_marks_each_step_ok():
    state = {"plan": [{"step": "a"}, {"step": "b"}]}
    out = await executor.run(state)
    assert out["phase"] == "executed"
    assert all(r["status"] == "ok" for r in out["results"])


@pytest.mark.asyncio
async def test_verifier_marks_verified_when_all_ok():
    out = await verifier.run({"results": [{"step": "a", "status": "ok"}]})
    assert out["verified"] is True
    assert out["phase"] == "verified"


@pytest.mark.asyncio
async def test_verifier_flags_failures():
    out = await verifier.run({"results": [{"step": "a", "status": "ok"}, {"step": "b", "status": "err"}]})
    assert out["verified"] is False
    assert out["phase"] == "failed"
    assert "b" in out["failures"]


@pytest.mark.asyncio
async def test_human_review_approved_path():
    out = await human_review.run({"human_decision": "approved"})
    assert out["phase"] == "approved"


@pytest.mark.asyncio
async def test_human_review_rejected_path():
    out = await human_review.run({"human_decision": "rejected"})
    assert out["phase"] == "rejected"
    assert out["verified"] is False
