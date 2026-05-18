"""Base StateGraph wiring.

Topology:

    START -> planner -> executor -> human_review -> verifier -> END

`human_review` is configured as an interrupt point so a human-in-loop reviewer
can resume runs via `POST /graph/runs/:id/resume`. Checkpoints persist via the
Postgres checkpointer when `PG_DSN` is configured; tests use the in-memory
fallback.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.config import get_settings
from app.nodes import executor as executor_node
from app.nodes import human_review as human_review_node
from app.nodes import planner as planner_node
from app.nodes import verifier as verifier_node


class RunState(TypedDict, total=False):
    role: str
    issueId: str
    runId: str
    input: dict[str, Any]
    plan: list[dict[str, Any]]
    results: list[dict[str, Any]]
    verified: bool
    failures: list[str]
    phase: str
    human_decision: str


def build_graph_definition() -> StateGraph:
    """Build the compiled-free `StateGraph` definition.

    Kept separate so tests can compile against a memory checkpointer and the
    HTTP layer can compile against the Postgres checkpointer.
    """
    g = StateGraph(RunState)
    g.add_node("planner", planner_node.run)
    g.add_node("executor", executor_node.run)
    g.add_node("human_review", human_review_node.run)
    g.add_node("verifier", verifier_node.run)
    g.add_edge(START, "planner")
    g.add_edge("planner", "executor")
    g.add_edge("executor", "human_review")
    g.add_edge("human_review", "verifier")
    g.add_edge("verifier", END)
    return g


@asynccontextmanager
async def checkpointer_lifespan() -> AsyncIterator[Any]:
    """Yield a checkpointer instance scoped to the application lifetime.

    Uses the Postgres async checkpointer when `PG_DSN` is set; falls back to
    `MemorySaver` for test/dev runs that don't have a Postgres reachable.
    """
    dsn = get_settings().pg_dsn
    if not dsn:
        yield MemorySaver()
        return
    # Import lazily so unit tests without psycopg can still build the graph.
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

    async with AsyncPostgresSaver.from_conn_string(dsn) as saver:
        await saver.setup()
        yield saver


def compile_graph(checkpointer: Any) -> Any:
    """Compile the StateGraph with the provided checkpointer.

    The compiled graph interrupts before `human_review` so callers see the
    pause and can drive resumption with a decision payload.
    """
    g = build_graph_definition()
    return g.compile(
        checkpointer=checkpointer,
        interrupt_before=["human_review"],
    )
