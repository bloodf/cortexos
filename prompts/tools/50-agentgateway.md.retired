# 50 - AgentGateway

AgentGateway is rebuilt as a Python MCP allowlist proxy.

Source:

- `stacks/cortex-agentgateway/app.py`
- `stacks/cortex-agentgateway/config/tools.json`

Validation:

```bash
curl -fsS http://127.0.0.1:18800/health
curl -fsS http://127.0.0.1:18800/tools
```

The target auth model is trusted LAN/tailnet with no app token. Every request
is audited as a JSON line for journald/Loki.
