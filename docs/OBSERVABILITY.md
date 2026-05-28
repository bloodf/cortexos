# Observability

Monitoring remains Prometheus, Grafana, and Loki. Alerts are dashboard-only.

The rebuild removes external trace collectors from the critical path. Dashboard
helper commands, AgentGateway requests, backups, and validation gates must emit
operator-readable evidence into Postgres, journald, or local backup metadata.
