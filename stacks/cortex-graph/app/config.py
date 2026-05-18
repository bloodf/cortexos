"""Runtime configuration loaded from environment.

Secrets resolve via /opt/cortexos/.secrets/graph.env (SOPS-decrypted at boot).
This module never reads disk directly — it only consumes process env so it is
testable without filesystem mocks.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Graph sidecar settings.

    All fields are immutable after first construction. Mutating settings
    is unsupported; build a new instance instead.
    """

    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False, extra="ignore")

    # HTTP API
    graph_port: int = Field(default=8090, alias="GRAPH_PORT")
    graph_bearer: str = Field(default="", alias="CORTEX_GRAPH_API_TOKEN")

    # Postgres checkpointer
    pg_dsn: str = Field(default="", alias="PG_DSN")

    # NATS bridge
    nats_url: str = Field(default="nats://127.0.0.1:4222", alias="NATS_URL")
    nats_hmac: str = Field(default="", alias="CORTEX_NATS_HMAC")
    nats_enabled: bool = Field(default=True, alias="CORTEX_GRAPH_NATS_ENABLED")

    # Observability
    otlp_endpoint: str = Field(default="", alias="OTEL_EXPORTER_OTLP_ENDPOINT")
    service_name: str = Field(default="cortex-graph", alias="OTEL_SERVICE_NAME")

    # Behavior
    require_envelope: bool = Field(default=True, alias="CORTEX_REQUIRE_ENVELOPE")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return process-wide settings singleton."""
    return Settings()
