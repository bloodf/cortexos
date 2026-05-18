"""NATS bridge: invoke graph runs from NATS and publish back run state.

Subscribes to `cortex.graph.invoke.>` and translates incoming messages into
HTTP-equivalent run starts; publishes `cortex.graph.state.<scope>` lifecycle
events using the signed CloudEvents envelope (see `app/envelope.py`).
"""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from app.config import get_settings
from app.envelope import build_cloud_event, sign, verify
from app.state import GraphErrorInfo, GraphRunState, NodeStatus

log = logging.getLogger(__name__)


class NatsBridge:
    """Minimal NATS pub/sub bridge that reuses the consumer's envelope contract."""

    def __init__(self, on_invoke):
        self._on_invoke = on_invoke
        self._nc: Any = None
        self._sub: Any = None
        self._task: asyncio.Task | None = None

    async def connect(self) -> None:
        settings = get_settings()
        if not settings.nats_enabled:
            log.info("nats bridge disabled via env")
            return
        try:
            import nats  # type: ignore
        except ImportError:
            log.warning("nats-py not installed; bridge stays offline")
            return
        self._nc = await nats.connect(settings.nats_url, name="cortex-graph")
        self._sub = await self._nc.subscribe(
            "cortex.graph.invoke.>",
            cb=self._handle,
        )
        log.info("nats bridge subscribed", extra={"subject": "cortex.graph.invoke.>"})

    async def _handle(self, msg: Any) -> None:
        secret = get_settings().nats_hmac
        try:
            envelope = json.loads(msg.data.decode("utf-8"))
        except json.JSONDecodeError:
            log.warning("invoke: invalid json")
            return
        if not verify(envelope, secret):
            log.warning("invoke: hmac mismatch")
            return
        ce = envelope.get("data", {})
        data = ce.get("data") if isinstance(ce, dict) else None
        if not isinstance(data, dict):
            log.warning("invoke: missing inner data")
            return
        try:
            await self._on_invoke(data)
        except Exception as exc:  # noqa: BLE001 — bridge keeps running
            log.exception("invoke handler failed: %s", exc)

    async def publish_state(self, *, snapshot: GraphRunState) -> None:
        if self._nc is None:
            return
        secret = get_settings().nats_hmac
        if not secret:
            log.warning("publish_state: CORTEX_NATS_HMAC missing — skipping")
            return
        ce = build_cloud_event(
            event_type=f"cortex.graph.state.{snapshot.runId}.v1",
            source="cortex-graph",
            subject=snapshot.runId,
            data=snapshot.model_dump(mode="json"),
        )
        envelope = sign(ce, secret)
        # Subject derives from runId so subscribers can filter per-run.
        subject = f"cortex.graph.state.{snapshot.runId}"
        await self._nc.publish(subject, json.dumps(envelope).encode("utf-8"))

    async def emit_lifecycle(
        self,
        *,
        run_id: str,
        node_id: str,
        state: NodeStatus,
        scope: str = "run",  # retained for caller compatibility; subject uses runId
        checkpoint: str | None = None,
        output: dict | None = None,
        error: GraphErrorInfo | dict | None = None,
    ) -> None:
        err: GraphErrorInfo | None
        if isinstance(error, GraphErrorInfo) or error is None:
            err = error
        else:
            err = GraphErrorInfo(**error)
        snap = GraphRunState(
            runId=run_id,
            nodeName=node_id,
            status=state,
            output=output or {},
            error=err,
            checkpoint=checkpoint,
        )
        await self.publish_state(snapshot=snap)

    async def close(self) -> None:
        try:
            if self._sub is not None:
                await self._sub.unsubscribe()
            if self._nc is not None:
                await self._nc.drain()
        except Exception:  # noqa: BLE001
            log.exception("nats bridge close failed")


@asynccontextmanager
async def lifespan(on_invoke):
    bridge = NatsBridge(on_invoke)
    await bridge.connect()
    try:
        yield bridge
    finally:
        await bridge.close()
