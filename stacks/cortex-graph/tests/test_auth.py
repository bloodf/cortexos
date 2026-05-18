"""Auth dependency edge cases."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.auth import require_bearer
from app.config import get_settings


@pytest.mark.asyncio
async def test_missing_header_rejected():
    with pytest.raises(HTTPException) as exc:
        await require_bearer(authorization=None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_non_bearer_scheme_rejected():
    with pytest.raises(HTTPException):
        await require_bearer(authorization="Basic abc")


@pytest.mark.asyncio
async def test_unconfigured_server_503(monkeypatch):
    monkeypatch.setenv("CORTEX_GRAPH_API_TOKEN", "")
    get_settings.cache_clear()
    with pytest.raises(HTTPException) as exc:
        await require_bearer(authorization="Bearer x")
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_matching_token_passes(monkeypatch):
    monkeypatch.setenv("CORTEX_GRAPH_API_TOKEN", "ok-token")
    get_settings.cache_clear()
    # Returns None on success.
    assert await require_bearer(authorization="Bearer ok-token") is None
