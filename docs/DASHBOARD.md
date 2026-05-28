# Dashboard

The dashboard is a LAN/tailnet control console with no app login in the target
architecture.

Root operations go through the dashboard helper Unix socket and must record
command metadata to Postgres and journald. The helper audit contract lives in
`manifests/rebuild/dashboard-helper-audit.sql` and
`manifests/rebuild/dashboard-helper-log-format.json`.
