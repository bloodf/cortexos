"""Planner node — converts an inbound run request into an ordered plan.

This is the first node in the base StateGraph. The current implementation is
deterministic and dependency-free so it can be exercised under unit tests
without a model backend; real LLM integration plugs in by replacing
`build_plan`.
"""

from __future__ import annotations

from typing import Any


def build_plan(role: str, payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Produce a small, role-aware plan."""
    base = [
        {"step": "summarize", "role": role},
        {"step": "draft", "role": role},
        {"step": "self_check", "role": role},
    ]
    title = payload.get("title") or payload.get("issueId")
    if title:
        base.insert(0, {"step": "intake", "title": title})
    return base


async def run(state: dict[str, Any]) -> dict[str, Any]:
    role = state.get("role", "unknown")
    payload = state.get("input", {})
    plan = build_plan(role, payload)
    return {**state, "plan": plan, "phase": "planned"}
