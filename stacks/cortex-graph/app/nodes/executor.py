"""Executor node — walks the planner's plan and records per-step results.

Pure-Python placeholder so the graph end-to-end works without external model
calls. Replacing `execute_step` is the integration seam for tool/model use.
"""

from __future__ import annotations

from typing import Any


def execute_step(step: dict[str, Any]) -> dict[str, Any]:
    return {**step, "status": "ok"}


async def run(state: dict[str, Any]) -> dict[str, Any]:
    plan: list[dict[str, Any]] = state.get("plan", [])
    results = [execute_step(step) for step in plan]
    return {**state, "results": results, "phase": "executed"}
