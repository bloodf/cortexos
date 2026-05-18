"""Run orchestration glue between HTTP/NATS surfaces and the compiled graph.

Encapsulates checkpointer/graph lifecycle, run dispatch, state inspection, and
human-in-loop resumption. Stateless from a user perspective — every call
re-reads checkpointer state keyed by `thread_id`.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from app.envelope import new_event_id
from app.graph import compile_graph
from app.nodes.human_review import run as human_review_run  # re-export hint
from app.state import GraphRunState, NodeStatus, RunResponse, StateSnapshot

log = logging.getLogger(__name__)

# Re-export to make the import side-effect explicit for callers.
__all__ = ["RunOrchestrator", "human_review_run"]


def _make_run_id() -> str:
    return f"run_{uuid.uuid4().hex}"


def _make_thread_id(role: str, issue_id: str) -> str:
    return f"thread_{role}_{issue_id}_{new_event_id()}"


class RunOrchestrator:
    """Drives the compiled LangGraph and emits NATS lifecycle events.

    Instances are reusable across requests; the compiled graph is bound to a
    checkpointer that itself owns its connection pool.
    """

    def __init__(self, checkpointer: Any, bridge: Any | None = None) -> None:
        self._graph = compile_graph(checkpointer)
        self._bridge = bridge

    async def _emit(self, run_id: str, node_id: str, state: NodeStatus) -> None:
        if self._bridge is None:
            return
        try:
            await self._bridge.emit_lifecycle(
                run_id=run_id,
                node_id=node_id,
                state=state,
                scope="run",
            )
        except Exception:  # noqa: BLE001 — telemetry must never break a run
            log.exception("emit_lifecycle failed")

    async def start(
        self,
        *,
        role: str,
        issue_id: str,
        payload: dict[str, Any],
        thread_id: str | None = None,
    ) -> RunResponse:
        run_id = _make_run_id()
        tid = thread_id or _make_thread_id(role, issue_id)
        cfg = {"configurable": {"thread_id": tid}}
        await self._emit(run_id, "planner", NodeStatus.running)
        result = await self._graph.ainvoke(
            {"role": role, "issueId": issue_id, "runId": run_id, "input": payload},
            cfg,
        )
        phase = result.get("phase", "interrupted") if isinstance(result, dict) else "interrupted"
        status = "interrupted" if phase != "verified" else "completed"
        node = "human_review" if phase != "verified" else "verifier"
        await self._emit(
            run_id, node, NodeStatus.awaiting_human if status == "interrupted" else NodeStatus.completed
        )
        return RunResponse(runId=run_id, threadId=tid, status=status, nodeId=node)

    async def resume(
        self,
        *,
        thread_id: str,
        decision: str,
        override: dict[str, Any] | None = None,
    ) -> RunResponse:
        cfg = {"configurable": {"thread_id": thread_id}}
        snapshot = await self._graph.aget_state(cfg)
        run_id = ""
        values = snapshot.values if snapshot else {}
        if isinstance(values, dict):
            run_id = str(values.get("runId", ""))
        patched = {"human_decision": decision}
        if override:
            patched.update(override)
        await self._graph.aupdate_state(cfg, patched)
        result = await self._graph.ainvoke(None, cfg)
        phase = result.get("phase", "completed") if isinstance(result, dict) else "completed"
        node = "verifier"
        state = NodeStatus.completed if phase == "verified" else NodeStatus.failed
        await self._emit(run_id, node, state)
        status = "completed" if phase == "verified" else "failed"
        return RunResponse(runId=run_id, threadId=thread_id, status=status, nodeId=node)

    async def get_state(self, *, thread_id: str) -> StateSnapshot:
        cfg = {"configurable": {"thread_id": thread_id}}
        snapshot = await self._graph.aget_state(cfg)
        values: dict[str, Any] = snapshot.values if snapshot else {}
        if not isinstance(values, dict):
            values = {}
        run_id = str(values.get("runId", ""))
        node_id: str | None = None
        if snapshot and snapshot.next:
            node_id = snapshot.next[0]
        elif "phase" in values:
            node_id = "verifier"
        return StateSnapshot(
            runId=run_id,
            threadId=thread_id,
            nodeId=node_id,
            state=str(values.get("phase", "unknown")),
            values=values,
            next=list(snapshot.next) if snapshot and snapshot.next else [],
            checkpoint=getattr(snapshot, "config", {}).get("configurable", {}).get(
                "checkpoint_id"
            )
            if snapshot
            else None,
        )

    def snapshot_from_state(self, *, run_id: str, node_id: str, phase: str) -> GraphRunState:
        state_map = {
            "verified": NodeStatus.completed,
            "failed": NodeStatus.failed,
            "interrupted": NodeStatus.awaiting_human,
        }
        return GraphRunState(
            runId=run_id,
            nodeName=node_id,
            status=state_map.get(phase, NodeStatus.pending),
        )
