"""Human-review node — pause point for human-in-the-loop approval.

LangGraph drives the actual interrupt via `interrupt_before`; this module
encodes the bookkeeping that runs when control returns from the human.
"""

from __future__ import annotations

from typing import Any


async def run(state: dict[str, Any]) -> dict[str, Any]:
    decision = state.get("human_decision")
    if decision == "rejected":
        return {**state, "phase": "rejected", "verified": False}
    return {**state, "phase": "approved"}
