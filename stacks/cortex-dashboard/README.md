# Cortex Dashboard Stack

The dashboard runs as the **native systemd unit** `cortex-dashboard.service`
(built on the host by `scripts/ops/cortex-dashboard-build.sh`). It is **not** a
container.

`docker-compose.yml` here is **retired** (`docker-compose.yml.retired`) — the
former on-host image build. The only live compose file is
`packages/cortex-dashboard/docker-compose.yml`, a `local-db` postgres helper for
ad-hoc local development.

See `packages/cortex-dashboard/CLAUDE.md` for build, deploy, and admin lifecycle.
