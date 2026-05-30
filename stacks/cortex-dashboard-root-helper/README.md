# Cortex Dashboard Root Helper

Privileged Unix-socket command executor for the trusted LAN/Tailscale dashboard.

- Socket: `/run/cortexos/dashboard-helper.sock`
- Protocol: newline-delimited JSON request/response
- Runtime audit: structured JSON to journald with identifier
  `cortex-dashboard-root-helper`
- Postgres audit: dashboard writes `dashboard_command_audit` rows before and
  after helper execution

The helper does not store stdout/stderr bodies or secret env values in logs.
