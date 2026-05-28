# AgentGateway

AgentGateway is a host-resident Python MCP allowlist proxy.

- Source: `stacks/cortex-agentgateway`.
- Policy: `stacks/cortex-agentgateway/config/tools.json`.
- Auth: no app token on trusted LAN/tailnet.
- Audit: one JSON line per request to stdout for journald/Loki.
- Health: `GET /health`.
- Tool list: `GET /tools`.
- Invocation gate: `POST /mcp/invoke`.

The current implementation validates allowlisted tool names and returns a
proxy-ready response. Backend MCP connector wiring is a later phase.
