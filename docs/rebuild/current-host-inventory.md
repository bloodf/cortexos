# CortexOS Current Host Inventory

Status: read-only snapshot captured on 2026-05-28.

Source command:

```bash
scripts/rebuild/inventory.sh --output /tmp/cortexos-inventory-remote-test
```

This document summarizes the live host without recording secret values. The raw
snapshot remains local in `/tmp/cortexos-inventory-remote-test` for this run.

## Host Baseline

- Host: `cortexos`.
- OS: Ubuntu 26.04 LTS `resolute`.
- Kernel: Linux 7.0.0-15-generic x86_64.
- SSH user: `cortexos`.
- User groups include `sudo`, `docker`, and `ollama`.
- Tailscale is running as `cortexos.<your-tailnet>.ts.net` with Tailscale SSH
  capability and a visible DNS health warning about `resolvconf`.
- Caddy config exists at `/etc/caddy/Caddyfile` and validates successfully.

## Installed Tooling

Manual apt/package surface includes:

- Core admin/runtime: `bash`, `zsh`, `git`, `gh`, `curl`, `jq`, `ripgrep`,
  `openssh-server`, `ufw`, `fail2ban`, `auditd`, `cockpit`, `webmin`.
- Container/runtime: `docker-ce`, `docker-ce-cli`, `docker-compose-plugin`,
  `containerd.io`, `apparmor`.
- Web/data: `caddy`, `postgresql`, `postgresql-18-timescaledb`, PHP 8.5
  packages, `composer`, `nodejs`.
- AI/dev/media: `ffmpeg`, `tesseract-ocr`, `tesseract-ocr-por`, `xvfb`,
  `rustc`, `cargo`, `python3-dev`, `python3-pip`, `python3-venv`.
- Retired or cleanup candidates still installed: `natscli`.

Snap packages:

- `core24`
- `snapd`
- `terraform`

Global npm packages:

- `@openai/codex@0.134.0`
- `9router@0.4.63`
- `better-sqlite3@12.6.2`
- `corepack@0.35.0`
- `npm@11.16.0`
- `systray2@2.1.4`
- `uv@1.4.0`

Local command surface:

- `~/.local/bin`: `codex-yolo`, `hermes`, `hermes-3guns`,
  `hermes-celebrar`, `hermes-cieucpb`, `hermes-cortex`,
  `hermes-mementry`, `hermes-netbook`, `omp`, `rmux`, `rtk`,
  `trafilatura`, `uv`, `uvx`.
- `/usr/local/bin`: `cortex-synthetic-publish.sh`, `cosign`, `nats`,
  `ollama`, `sops`, `syft`.

## Active Systemd Surface

Active or notable Cortex-related units:

- Active: `9router.service`, `9router-docker-proxy.service`,
  `caddy.service`, `cortex-dashboard.service`,
  `cortex-mail-guardian.service`, `hermes-dashboard.service`,
  `hermes-dashboard-proxy.service`, `hermes-gateway-cortex.service`,
  `hermes-gateway@cieucpb.service`, `hermes-gateway@netbook.service`,
  `hermes-profile@cortex.service`, `hermes-profile@cieucpb.service`,
  `hermes-profile@netbook.service`, `honcho-mcp.service`, `ollama.service`,
  `ollama-honcho-embeddings-proxy.service`,
  `tailscaled.service`, `webmin.service`.
- Retired: `hermes-profile@default`, `hermes-profile@primary`, `hermes-gateway@default`.
- Failed: `cortex-backup.service`.
  Note: paperclip, floci, cortex-langfuse were retired in Phase 8.
  cortex-synthetic@ was retired in Phase C5.
- Inactive but installed: `postgresql.service`, `postgresql@18-main.service`,
  `cockpit.service`, several Cortex timer-activated services.
- Timers include `cortex-backup.timer`, `cortex-auto-update.timer`,
  `cortex-9router-health.timer`, `cortex-degraded-service-watcher.timer`,
  `cortex-mail-guardian-sweep.timer`. Note: Paperclip recovery timer retired in Phase C5.

## Active Docker Compose Surface

Host/control-plane stacks currently running in Docker:

- `cortex-dashboard`
- `cortex-sandbox-runner`
- `dockhand`
- `home-assistant`
- `honcho`
- `jellyfin`
- `kernel-browser`
- `mongo-exporter`
- `mongodb`
- `monitoring`
- `mysql`
- `otel`
- `pg-exporter`
- `pgadmin`
- `postgresql`
- `redis`
- `redis-exporter`
- `redis-insight`
- `watchtower`

Project stacks currently running directly on the host:

- `mementry` API stack: Postgres, Redis, MinIO.
- `celebrar.me` Laravel stack: app/e2e container, Mailhog, MinIO, Postgres,
  Redis.

Retired runtime (Phase 8 cleanup completed):

- `paperclip.service` — retired and removed.
- `floci` Docker stack — retired and removed.
- `cortex-langfuse` Docker stack — retired and removed.
- `nats` binaries/packages — retired and removed.

## Hermes Identity Snapshot

Profile directories found under `/opt/cortexos/hermes/profiles`:

- Active host profiles: `cortex`, `netbook`, `cieucpb` only.
- Project profiles run inside Incus instances: `3guns`, `celebrar`, `mementry`.
- Retired/removed: `default`, `primary`, `[object Object]`.

Hermes-related secret env files found by name only:

- `/opt/cortexos/.secrets/hermes/3guns.env`
- `/opt/cortexos/.secrets/hermes/celebrar.env`
- `/opt/cortexos/.secrets/hermes/cieucpb.env`
- `/opt/cortexos/.secrets/hermes/mementry.env`
- `/opt/cortexos/.secrets/hermes/netbook.env`

The backup phase must preserve protected profiles, env files, sessions,
memories, hooks, skills, pairing data, logs, and Honcho-linked state before any
cleanup.

## Project Repo Snapshot

Project repos found under `/home/cortexos/Developer/github/bloodf`:

- `celebrar.me`: `main`, clean in the captured status output.
- `mementry`: `main`, dirty worktree with modified and untracked files.
- `3guns`: `main`, dirty worktree with modified and untracked files.

The target architecture intentionally uses clean GitHub `main` clones in Incus
instances. Host dirty states must be archived before removal, but not migrated
into the new project instances.

## Secrets Metadata Snapshot

Secret values were not read. File names show active and stale secret surfaces:

- Core: `9router.env`, `backup.env`, `dashboard.env`, `grafana.env`,
  `honcho.env`, `kernel-browser.env`, `mail-guardian.env`, `mcp.env`,
  `mongodb.env`, `mysql.env`, `pgadmin.env`, `redis.env`, `sandbox.env`.
- Identity: `backup-identity.txt`, `terminal_id_ed25519`,
  `terminal_id_ed25519.pub`.
- Retired/stale (to be removed): `langfuse.env`, `langfuse-client.env`,
  `paperclip.env`, `paperclip-app.env`, `paperclip-keys.json`,
  `paperclip-agent-runtime-keys.json`, and backup variants.

## Post-Reconciliation Status (2026-05-28)

- Phase C completed: data-plane repointed to /opt/cortexos/stacks, old clone archived
  and removed, host project stacks torn down (Incus covers), drift-check tooling added.
- Phase D in progress: agentgateway → Obot MCP gateway migration.
- Remaining follow-ups: 6 systemd units drift (legacy /opt layout), orphaned C3 volumes.
- The `[object Object]` Hermes profile is a likely corrupt/stale profile name
  and should be cleaned only after Hermes backup and identity verification.
- `cortex-backup.service` is currently failed, so the rebuild backup flow must
  not depend on the existing backup unit.
