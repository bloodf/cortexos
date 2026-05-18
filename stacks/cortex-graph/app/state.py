"""Pydantic models for graph run state.

These models port `schemas/cortex-graph-state-v1.json` and define the input
contract that consumer/bridge senders use when invoking `/graph/runs`.
"""

from __future__ import annotations

import time
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NodeStatus(StrEnum):
    """Lifecycle status of an individual node within a run.

    Mirrors `schemas/cortex-graph-state-v1.json` `status` enum.
    """

    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    awaiting_human = "awaiting_human"


# Backwards-compatible alias for internal call sites that still reference
# the original `NodeState` symbol. Keep until V8.
NodeState = NodeStatus


class GraphErrorInfo(BaseModel):
    """Structured error envelope for failed node transitions."""

    model_config = ConfigDict(frozen=True, extra="allow")

    message: str = Field(min_length=1)
    code: str | None = None
    stack: str | None = None


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


class GraphRunState(BaseModel):
    """`cortex.graph.state.<runId>.v1` payload (CE data field).

    Immutable: every update must produce a new instance via `model_copy`.
    Wire shape matches `schemas/cortex-graph-state-v1.json` exactly.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    runId: str = Field(min_length=1)
    nodeName: str = Field(min_length=1)
    status: NodeStatus
    output: dict[str, Any] = Field(default_factory=dict)
    error: GraphErrorInfo | None = None
    ts: str = Field(default_factory=_now_iso)
    checkpoint: str | None = None


class RunRequest(BaseModel):
    """Body for `POST /graph/runs`.

    `role` selects the agent role (matches the Paperclip role in the consumer
    routing layer). `input` is the opaque payload passed to the planner node.
    """

    model_config = ConfigDict(extra="forbid")

    role: str = Field(min_length=1)
    issueId: str = Field(min_length=1)
    input: dict[str, Any] = Field(default_factory=dict)
    threadId: str | None = None


class RunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runId: str
    threadId: str
    status: str
    nodeId: str | None = None


class ResumeRequest(BaseModel):
    """Body for `POST /graph/runs/:id/resume`.

    Used by human-in-loop reviewers to release a paused run with an approval
    decision (`approved` / `rejected`) and optional override payload.
    """

    model_config = ConfigDict(extra="forbid")

    decision: str = Field(pattern="^(approved|rejected)$")
    note: str | None = None
    override: dict[str, Any] | None = None


class StateSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runId: str
    threadId: str
    nodeId: str | None
    state: str
    values: dict[str, Any]
    next: list[str] = Field(default_factory=list)
    checkpoint: str | None = None
