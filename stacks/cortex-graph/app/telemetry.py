"""OpenLLMetry + Langfuse initialisation for cortex-graph.

Mirrors the contract of `@cortexos/telemetry` on the Node side:

* `instrument(service, env)` is idempotent and safe to call at boot.
* When `LANGFUSE_HOST` (or `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`) is
  unset, the function is a no-op so the sidecar still boots cleanly in
  dev / test environments without observability infrastructure.
* `traceloop-sdk` is imported lazily — services that never call
  `instrument()` do not pay the import cost.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

log = logging.getLogger(__name__)

_INITIALIZED = False
_CONFIG: Optional["TelemetryConfig"] = None


@dataclass(frozen=True)
class TelemetryConfig:
    enabled: bool
    host: str
    public_key: str
    secret_key: str
    service: str
    env: str


def _read_config(service: Optional[str], env: Optional[str]) -> TelemetryConfig:
    host = os.environ.get("LANGFUSE_HOST", "")
    public_key = os.environ.get("LANGFUSE_PUBLIC_KEY", "")
    secret_key = os.environ.get("LANGFUSE_SECRET_KEY", "")
    disabled = os.environ.get("CORTEX_TELEMETRY_DISABLED", "") in {"1", "true", "True"}
    return TelemetryConfig(
        enabled=bool(host and public_key and secret_key) and not disabled,
        host=host,
        public_key=public_key,
        secret_key=secret_key,
        service=service or os.environ.get("CORTEX_TELEMETRY_SERVICE", "cortex-graph"),
        env=env or os.environ.get("CORTEX_TELEMETRY_ENV") or os.environ.get("APP_ENV", "production"),
    )


def instrument(service: Optional[str] = None, env: Optional[str] = None) -> TelemetryConfig:
    """Initialise OpenLLMetry + Langfuse exporters. Idempotent."""
    global _INITIALIZED, _CONFIG
    if _INITIALIZED and _CONFIG is not None:
        return _CONFIG
    cfg = _read_config(service, env)
    _CONFIG = cfg
    _INITIALIZED = True
    if not cfg.enabled:
        log.info("telemetry disabled (LANGFUSE_HOST unset or CORTEX_TELEMETRY_DISABLED=1)")
        return cfg
    try:
        # Lazy imports so the dependency cost is paid only when telemetry is on.
        from traceloop.sdk import Traceloop  # type: ignore[import-not-found]
    except Exception as exc:  # pragma: no cover - exercised in integration env
        log.warning("telemetry init skipped — traceloop-sdk not importable: %s", exc)
        _CONFIG = TelemetryConfig(
            enabled=False,
            host=cfg.host,
            public_key=cfg.public_key,
            secret_key=cfg.secret_key,
            service=cfg.service,
            env=cfg.env,
        )
        return _CONFIG
    try:
        Traceloop.init(
            app_name=cfg.service,
            api_key=cfg.secret_key,
            api_endpoint=f"{cfg.host.rstrip('/')}/api/public/otel",
            disable_batch=cfg.env != "production",
        )
        log.info("telemetry initialised service=%s env=%s host=%s", cfg.service, cfg.env, cfg.host)
    except Exception as exc:  # pragma: no cover - exercised in integration env
        log.warning("telemetry Traceloop.init failed: %s", exc)
        _CONFIG = TelemetryConfig(
            enabled=False,
            host=cfg.host,
            public_key=cfg.public_key,
            secret_key=cfg.secret_key,
            service=cfg.service,
            env=cfg.env,
        )
    return _CONFIG


def is_enabled() -> bool:
    return bool(_CONFIG and _CONFIG.enabled)


def reset_for_tests() -> None:
    """Internal: reset module state between unit tests."""
    global _INITIALIZED, _CONFIG
    _INITIALIZED = False
    _CONFIG = None
