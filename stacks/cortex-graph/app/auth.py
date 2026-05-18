"""Bearer-token authentication for graph HTTP endpoints.

Single-token model: `CORTEX_GRAPH_API_TOKEN` env var. Token comparison uses
`hmac.compare_digest` to resist timing side-channels.
"""

from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from app.config import get_settings


def _extract_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2:
        return None
    scheme, token = parts
    if scheme.lower() != "bearer":
        return None
    return token.strip()


async def require_bearer(authorization: str | None = Header(default=None)) -> None:
    """FastAPI dependency: rejects requests without a valid bearer token.

    The configured token must be non-empty; an unconfigured server refuses
    every request to prevent accidental open exposure.
    """
    expected = get_settings().graph_bearer
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="graph_bearer_unconfigured",
        )
    provided = _extract_token(authorization)
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_bearer",
            headers={"WWW-Authenticate": "Bearer"},
        )
