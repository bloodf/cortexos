# Cortex AgentGateway

AgentGateway is now a small Python MCP control proxy. It keeps a global
allowlist, exposes health and policy endpoints, and writes one-line JSON audit
events to stdout for journald/Loki ingestion.

It intentionally has no retired bus, tracing, bearer-token, role-factory, or
event-envelope dependency. Network trust is provided by the LAN/tailnet
boundary defined in `PLAN.md`; policy enforcement is the global allowlist in
`config/tools.json`.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness plus policy version. |
| `GET` | `/tools` | Allowed tool names and descriptions. |
| `POST` | `/mcp/invoke` | Validate a tool request against the allowlist and echo a proxy-ready response. |

`POST /mcp/invoke` accepts:

```json
{
  "tool": "service.status",
  "arguments": {"service": "postgresql"},
  "agent_id": "cortex",
  "project": "host"
}
```

Allowed calls return `{"ok": true, "proxied": false, ...}` until backend MCP
connectors are wired. Denied calls return HTTP `403` and are audited.
