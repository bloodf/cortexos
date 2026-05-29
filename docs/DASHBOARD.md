# Dashboard

The dashboard is a LAN/tailnet control console. It runs as the native systemd
unit `cortex-dashboard.service` (no Docker/container) on port 3080, built on the
host by `scripts/ops/cortex-dashboard-build.sh`. Login is **Linux PAM**: an OS
account authenticates against host PAM, and admin rights derive from membership
in the `cortexos-admin` / `sudo` groups. See
`packages/cortex-dashboard/CLAUDE.md` for the build, deploy, and admin lifecycle.

Root operations go through the dashboard helper Unix socket and must record
command metadata to Postgres and journald. The helper audit contract lives in
`manifests/rebuild/dashboard-helper-audit.sql` and
`manifests/rebuild/dashboard-helper-log-format.json`.
