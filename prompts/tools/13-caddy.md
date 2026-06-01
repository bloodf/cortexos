# 13 - Caddy

Caddy remains on the host as the canonical LAN/tailnet routing entrypoint.

Routes must match the dashboard catalog helper in
`packages/dashboard/migrations/014_dynamic_service_visibility.sql`.

Expected web surfaces include dashboard, 9Router, Grafana, Prometheus, Loki,
cAdvisor, Jellyfin, Home Assistant, Cockpit, Webmin, Obot, and database admin
UIs.

Record route validation evidence in `PLAN.md`.
