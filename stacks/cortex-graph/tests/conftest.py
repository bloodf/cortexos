"""Pytest fixtures.

The graph tests run against an in-memory checkpointer so they can execute
without a Postgres container. Integration tests that exercise the Postgres
checkpointer are marked `integration` and skipped by default.
"""

from __future__ import annotations

import os

import pytest

os.environ.setdefault("CORTEX_GRAPH_API_TOKEN", "test-token")
os.environ.setdefault("CORTEX_GRAPH_NATS_ENABLED", "0")
os.environ.setdefault("PG_DSN", "")
os.environ.setdefault("CORTEX_NATS_HMAC", "test-hmac")

from app.config import get_settings  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
