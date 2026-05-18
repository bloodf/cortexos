"""Verifier node — final pass over executor results.

Returns `verified: True` when every step reports `status == "ok"`; otherwise
marks the run failed and surfaces the offending step ids.
"""

from __future__ import annotations

from typing import Any


async def run(state: dict[str, Any]) -> dict[str, Any]:
    results = state.get("results", [])
    failed = [r for r in results if r.get("status") != "ok"]
    if failed:
        return {
            **state,
            "verified": False,
            "phase": "failed",
            "failures": [r.get("step") for r in failed],
        }
    return {**state, "verified": True, "phase": "verified"}
