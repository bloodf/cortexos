"""CloudEvents + HMAC envelope helpers.

Mirrors the JS reference at
`stacks/cortex-paperclip-bridge/lib/nats-publisher.js`. The on-wire shape for
every `cortex.graph.*` NATS publish is:

    { "data": <CloudEvent v1.0 object>, "sig": "<hex hmac-sha256>" }

Signature input is JCS-canonicalized `data` bytes (RFC 8785), HMAC keyed by
`CORTEX_NATS_HMAC`. Verifiers must reject envelopes whose `sig` does not
exactly match a recomputed signature over the canonical bytes.
"""

from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from typing import Any

import jcs


def new_event_id() -> str:
    """RFC 4122 v4 id. CloudEvents `id` field uses this."""
    return f"evt_{uuid.uuid4().hex}"


def now_iso() -> str:
    """RFC 3339 timestamp with second precision in UTC."""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def build_cloud_event(
    *,
    event_type: str,
    source: str,
    data: dict[str, Any],
    subject: str | None = None,
) -> dict[str, Any]:
    """Construct a CloudEvents v1.0 structured envelope.

    The returned dict is a new object — callers must not mutate it.
    """
    ce: dict[str, Any] = {
        "specversion": "1.0",
        "id": new_event_id(),
        "type": event_type,
        "source": source,
        "time": now_iso(),
        "datacontenttype": "application/json",
        "data": dict(data),
    }
    if subject is not None:
        ce["subject"] = subject
    return ce


def canonical_bytes(value: Any) -> bytes:
    """JCS canonical JSON (RFC 8785) — stable across encoders."""
    return jcs.canonicalize(value)


def sign(data: dict[str, Any], secret: str) -> dict[str, Any]:
    """Wrap CloudEvent `data` with HMAC signature.

    Raises ValueError if the HMAC secret is empty so signed publishes cannot
    silently degrade.
    """
    if not secret:
        raise ValueError("CORTEX_NATS_HMAC not configured")
    sig = hmac.new(secret.encode("utf-8"), canonical_bytes(data), hashlib.sha256).hexdigest()
    return {"data": data, "sig": sig}


def verify(envelope: dict[str, Any] | None, secret: str) -> bool:
    """Constant-time verification of a signed envelope."""
    if not secret or not isinstance(envelope, dict):
        return False
    data = envelope.get("data")
    sig = envelope.get("sig")
    if not isinstance(data, dict) or not isinstance(sig, str):
        return False
    expected = hmac.new(secret.encode("utf-8"), canonical_bytes(data), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
