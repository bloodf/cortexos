"""Envelope sign/verify symmetry + JCS stability."""

from __future__ import annotations

import pytest

from app.envelope import build_cloud_event, canonical_bytes, sign, verify


def test_canonical_bytes_stable_across_key_order():
    a = {"b": 1, "a": [3, 2, 1], "c": {"y": 1, "x": 2}}
    b = {"a": [3, 2, 1], "c": {"x": 2, "y": 1}, "b": 1}
    assert canonical_bytes(a) == canonical_bytes(b)


def test_sign_then_verify_round_trip():
    ce = build_cloud_event(
        event_type="cortex.graph.state.run.v1",
        source="cortex-graph",
        data={"runId": "r1", "nodeName": "planner", "status": "running", "output": {}, "error": None, "ts": "2026-01-01T00:00:00Z"},
    )
    env = sign(ce, "secret-key")
    assert verify(env, "secret-key")


def test_verify_rejects_tampered_payload():
    ce = build_cloud_event(
        event_type="cortex.graph.state.run.v1",
        source="cortex-graph",
        data={"runId": "r1", "nodeName": "planner", "status": "running", "output": {}, "error": None, "ts": "2026-01-01T00:00:00Z"},
    )
    env = sign(ce, "secret-key")
    env["data"]["data"]["nodeName"] = "executor"
    assert not verify(env, "secret-key")


def test_verify_rejects_wrong_secret():
    ce = build_cloud_event(
        event_type="cortex.graph.state.run.v1",
        source="cortex-graph",
        data={"runId": "r1", "nodeName": "planner", "status": "running", "output": {}, "error": None, "ts": "2026-01-01T00:00:00Z"},
    )
    env = sign(ce, "secret-key")
    assert not verify(env, "other-secret")


def test_sign_requires_secret():
    ce = build_cloud_event(event_type="t", source="s", data={"runId": "r", "nodeName": "n", "status": "running"})
    with pytest.raises(ValueError):
        sign(ce, "")


def test_verify_rejects_malformed_envelope():
    assert not verify({}, "k")
    assert not verify({"data": {}}, "k")
    assert not verify(None, "k")  # type: ignore[arg-type]


def test_cloud_event_required_fields():
    ce = build_cloud_event(event_type="t", source="s", data={"k": 1})
    for field in ("specversion", "id", "type", "source", "time", "data"):
        assert field in ce
    assert ce["specversion"] == "1.0"
