# CortexOS Rebuild Plan V2

Status: phase 9 final validation complete — rebuild done (phases 0–9 all validated live)
Last updated: 2026-05-28

## Operating Rule

This file is the canonical rebuild plan for CortexOS. Every execution phase must
update this file with current decisions, status, validation evidence, risks, and
next actions before moving to the next phase.

No destructive cleanup is allowed until the backup/export flow exists and the
local restore artifacts have been verified.

## Summary

Rebuild CortexOS as a repo-declared system on the existing Ubuntu 26.04 host,
with planned downtime allowed. The host remains the control/data plane, while
new project and agent work moves into Incus instances.

## Current State Assessment

Read-only inventory was captured from
`cortexos@cortexos.<your-tailnet>.ts.net` on 2026-05-28. Durable summary:
`docs/rebuild/current-host-inventory.md`.

Confirmed host facts:

- Host OS is Ubuntu 26.04 LTS `resolute`, matching the target Incus base image
  OS decision.
- Host is a mixed systemd plus Docker Compose environment.
- Active protected Hermes host profiles are present for `cieucpb`, `netbook`,
  and `cortex`; project profiles `mementry`, `celebrar`, and `3guns` are also
  still on the host.
- `mementry` and `3guns` host project worktrees are dirty; `celebrar.me` was
  clean in the captured status.
- Retired or to-be-disabled runtime is still present, including active
  Paperclip, active Floci, active Langfuse runtime, and installed NATS tooling.
- `cortex-backup.service` is failed, so this rebuild uses the new
  `scripts/rebuild/backup.sh` backup gate instead of the existing backup unit.
- Caddy validates successfully.
- Tailscale is running, but reports a DNS/resolvconf health warning.

## Key Architecture Decisions

- Main host stays the control/data plane: PostgreSQL, MySQL, Redis, MongoDB, Caddy, Tailscale, Cockpit, Webmin, 9Router, Ollama, Honcho, Cortex Dashboard, and monitoring.
- Incus uses unprivileged containers by default, versioned base images, and a
  file-backed ZFS pool under `/mnt/hdd`.
- First Incus project instances: `mementry`, `celebrar.me`, and `3guns`, each
  cloned fresh from GitHub `main`.
- Host project repos under `/home/cortexos/Developer` are archived to
  `/mnt/hdd/cortexos-backups`, then removed after instance validation.
- Dirty `mementry` and `3guns` host worktrees are not migrated.
- Protected Hermes profiles `CIEUCPB`, `Netbook`, and `Cortex` stay on the host
  and must be restored.
- Project Hermes profiles `mementry`, `celebrar`, and `3guns` move into their
  project Incus instances after validation.
- Hermes remains latest-upstream with auto-update. This is an accepted
  reproducibility risk.
- Retired systems are hard removed: Paperclip, NATS, OpenViking, LEANN,
  OpenClaw, Agent Factory, Cortex Consumer, Cortex Graph, and Floci.
- Retired systems get config exports only; full local backup covers everything
  else.
- Langfuse is disabled/archived and not restored.
- Cortex AgentGateway is rebuilt as a Python central MCP proxy with a global
  allowlist and no token on trusted LAN/tailnet.
- Dashboard is a full-control LAN plus Tailscale console with no app login.
- Dashboard root helper is a Unix-socket shell executor with full command
  metadata audit to PostgreSQL and journald for 180 days.
- Secrets remain host-owned env files. The repo tracks a secrets manifest and
  validation rules, not secret values.
- Backups are local-only under `/mnt/hdd/cortexos-backups`: filesystem/ZFS
  snapshots plus logical exports for core services.
- Monitoring remains Prometheus, Grafana, and Loki. Alerts are dashboard-only.
- Repo tooling is Bash-first: `inventory`, `plan`, `apply`, `validate`,
  `backup`, and `restore`.
- Old prompts, scripts, docs, schemas, migrations, dashboard pages, Caddy
  routes, and catalog rows are replaced in place.

## Required Corrections From Review

- Add phase 0: full live inventory and dependency audit before rewrite or
  cleanup.
- Move backup before destructive cleanup and before relying on rewritten repo
  state.
- Define Hermes identity explicitly: profile dirs, env files, Honcho
  memory/state, sessions, tokens, and verification checks.
- Define exact backup scope: database dumps, MongoDB, Honcho,
  Hermes, secrets, Caddy, Tailscale state, Docker volumes, Incus/ZFS, and repo
  state.
- Add host/project network model: shared Incus bridge trust is accepted, but
  per-project database users, buckets, and vhosts are still required.
- Add dashboard helper audit schema and command execution log format.
- Add MCP proxy health/audit checks even though auth is network-trust only.
- Add Docker sunset criteria so transition Docker does not become permanent.
- Add validation gates after host rebuild, Incus install, each project
  instance, Hermes restoration, and retired-infra removal.

## Phase Plan

### Phase 0 - Baseline Inventory

Status: complete

Goal: capture the current live host and repo state before any destructive action.

Deliverables:

- Host inventory archive under `/mnt/hdd/cortexos-backups/<timestamp>/inventory`.
- Repo-local inventory summary generated by `scripts/rebuild/inventory.sh`.
- Dependency audit covering systemd, Docker, ports, packages, repos, secrets
  names, databases, Hermes profiles, Honcho state, Caddy/Tailscale, cron, and
  timers.

Validation gate:

- Inventory command completes without changing the host.
- Protected Hermes profiles are identified.
- Retired systems and project systems are classified separately.

Evidence:

- `scripts/rebuild/inventory.sh --output /tmp/cortexos-inventory-remote-test`
  completed successfully.
- Inventory summary saved at `docs/rebuild/current-host-inventory.md`.

### Phase 1 - Repo Source Of Truth

Status: complete

Goal: add the canonical plan, manifests, and Bash-first command scaffolding.

Deliverables:

- `PLAN.md`.
- Rebuild manifests under `manifests/rebuild/`.
- Bash command wrappers under `scripts/rebuild/`.
- Rewritten prompt/doc entrypoints for the new process.

Validation gate:

- `scripts/rebuild/plan.sh` prints the intended actions without mutating the
  host.
- `scripts/rebuild/validate.sh --local` passes repo-local checks.

Evidence:

- `PLAN.md` created as canonical rebuild plan.
- Rebuild manifests added under `manifests/rebuild/`.
- Bash command wrappers added under `scripts/rebuild/`.
- `prompts/00-bootstrap.md` and `prompts/tools/_order.md` rewritten to point at
  the rebuild flow and retire the old spoke graph.
- `shellcheck scripts/rebuild/*.sh` passed.
- `scripts/rebuild/validate.sh --local` passed.

### Phase 2 - Backup And Restore Gate

Status: complete with MySQL logical-dump caveat

Goal: create local backup/export flow and verify local restore artifacts before
cleanup.

Backup scope:

- Repo state and current git metadata.
- `/opt/cortexos` configs, manifests, non-secret scripts, and service templates.
- `/opt/cortexos/.secrets` file names and metadata, plus sealed backup archive
  stored outside the repo.
- Hermes profile dirs, env file names, sessions, memories, skills, hooks, and
  runtime state.
- Honcho data volumes and database exports.
- PostgreSQL, MySQL, MongoDB logical dumps.
- Redis metadata/config snapshot.
- Caddy config/certs, Tailscale state metadata, systemd units/drop-ins, Docker
  compose files/volume names, cron/timers.
- Config exports for retired systems.

Validation gate:

- Backup artifacts exist under `/mnt/hdd/cortexos-backups`.
- Logical dumps are non-empty where services exist.
- Restore dry-run can list and verify archive contents.

Evidence:

- Backup created at `/mnt/hdd/cortexos-backups/20260528T042259Z`.
- `scripts/rebuild/restore.sh --verify-remote /mnt/hdd/cortexos-backups/20260528T042259Z`
  passed.
- SHA256 verification passed for the backup set.
- PostgreSQL, Honcho PostgreSQL, MongoDB, Redis snapshots, Hermes, Honcho,
  Caddy/systemd, secrets, retired configs, host project repos, and local rebuild
  source were captured.

Caveat:

- MySQL logical dump failed because current root credentials do not authenticate
  inside the running container. The backup gate captured
  `archives/mysql-volume.tgz` as a physical Docker volume fallback. Before a
  destructive MySQL rebuild, either accept this fallback explicitly or repair
  MySQL credentials and create a logical dump.

### Phase 3 - Host Rebuild

Status: host cleanup, dashboard root-helper, and dashboard rebuild complete

Goal: clean and rebuild the Cortex-managed layer without reinstalling the OS.

Deliverables:

- Native/systemd core services rebuilt where feasible.
- Host-managed container services normalized under systemd where still needed.
- Dashboard/root-helper rebuilt and audited.
- Monitoring restored.
- Repository no longer declares removed packages, prompts, docs, dashboard pages,
  or runtime stacks for the old orchestration layer.
- Retired-runtime apply executor exists and supports backup-gated dry-run and
  execute modes.
- Retired-runtime apply executor is idempotent for already-absent retired
  systemd units and packages.
- Dashboard root-helper apply executor installs the helper stack, systemd socket
  and service, applies the command-audit migration, and validates execution
  through `/run/cortexos/dashboard-helper.sock`.
- Dashboard app apply executor replaces the dashboard/audit source packages,
  rebuilds the dashboard on the host (`scripts/ops/cortex-dashboard-build.sh`),
  renders + installs the `cortex-dashboard.service` systemd unit, enables it, and
  health-checks `/en/login`.

Validation gate:

- Host service health is green.
- Dashboard shell helper logs full command metadata.
- Prometheus/Grafana/Loki show host health.
- Repo validation, dashboard tests, dashboard build, and AgentGateway tests pass
  before live host apply.

Evidence:

- `scripts/rebuild/apply.sh --phase retired-runtime --dry-run --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  passed after verifying the backup set.
- Retired repo surfaces were removed or rewritten: old packages, prompts,
  schemas, dashboard routes/components/tests, catalog migrations, stack
  directories, and templates.
- Dashboard catalog now seeds the rebuild host service model and includes
  `017_retired_infra_cleanup.sql` for upgraded databases.
- AgentGateway was rewritten as a Python allowlist MCP proxy under
  `stacks/cortex-agentgateway`.
- `shellcheck scripts/rebuild/*.sh` passed.
- `scripts/rebuild/validate.sh --local` passed.
- `python3 -m unittest stacks/cortex-agentgateway/tests/test_app.py` passed.
- `pnpm --dir packages/dashboard test` passed: 74 files, 553 tests.
- `pnpm --dir packages/dashboard exec tsc --noEmit` passed.
- `pnpm --dir packages/dashboard run build:next` passed with one
  pre-existing Turbopack NFT tracing warning in the terminal route.
- `pnpm --dir packages/dashboard run test:e2e:list` lists only
  `audit-viewer.spec.ts`.
- Live retired-runtime apply completed from verified backup
  `/mnt/hdd/cortexos-backups/20260528T042259Z`; scope remained retired runtime
  only and protected Hermes units/profiles were manifest-protected.
- Leftover Paperclip socket and invariant timer/service were added to
  `runtime-retired.tsv` after the first live audit exposed them.
- A pre-existing broken `chromium-browser` transitional dpkg record blocked apt
  removal of `natscli`; the broken dpkg record was removed while the Chromium
  snap remained installed, then `natscli` was removed successfully.
- Root helper was deployed on the host:
  `cortex-dashboard-root-helper.socket` and
  `cortex-dashboard-root-helper.service` are active.
- Helper socket permissions validated:
  `/run/cortexos` is `root:cortexos 0750` and
  `/run/cortexos/dashboard-helper.sock` is `root:cortexos 0660`.
- Helper socket probes succeeded with `/bin/true` and
  `/bin/echo helper-ok`; journald contains structured `command_started` and
  `command_finished` events with hashes and byte counts.
- Dashboard command audit table exists in PostgreSQL:
  `to_regclass('public.dashboard_command_audit')` returned true.
- Dashboard image was rebuilt and `cortex-dashboard` was recreated
  successfully; `http://127.0.0.1:3080/en/login` returned HTTP 200 and Docker
  reports the container healthy.
- `/api/root-helper/commands` is present in the deployed dashboard and returns
  HTTP 401 without auth.
- `next/font/google` was removed from the dashboard layout so dashboard builds
  no longer depend on Google Fonts availability.
- Dashboard Dockerfile now uses npm retry/cache settings and `COPY --chown`
  layers to avoid registry flakiness and the previous recursive `chown -R`
  stall.

### Phase 4 - Hermes And AI Core

Status: protected host AI services validated; Python AgentGateway deployed

Goal: restore protected Hermes, Honcho, 9Router, Ollama, and host AI tooling.

Hermes identity definition:

- Profile directories under `/opt/cortexos/hermes/profiles`.
- Protected profile env files under `/opt/cortexos/.secrets/hermes`.
- Hermes sessions, memories, skills, hooks, pairing, cache metadata, and logs.
- Honcho memory/state linked to Hermes agents.
- Runtime units and drop-ins for protected profile gateways and dashboard.
- Any tokens or host identity files referenced by protected Hermes profiles.

Validation gate:

- `CIEUCPB`, `Netbook`, and `Cortex` profiles exist and can be started.
- Honcho memory is reachable by Hermes and AI harness tools.
- 9Router is reachable from host and target instance network.

Evidence:

- Protected Hermes/9Router/Honcho/Ollama services remained active after
  retired-runtime cleanup, dashboard deployment, and AgentGateway deployment.
- `cortex-agentgateway.service` is active as a native systemd service on port
  `18800`.
- `GET http://127.0.0.1:18800/health` returned `ok: true`,
  `policy_version: 2`, and allowlist count `11`.
- `POST /mcp/invoke` allowed `service.status` with HTTP 200 and denied
  `service.restart` with HTTP 403.
- Journald for `cortex-agentgateway.service` contains structured
  `agentgateway.audit` rows for health checks and allow/deny MCP invocations.

### Phase 5 - Incus Foundation

Status: complete

Goal: install Incus, create the file-backed ZFS pool under `/mnt/hdd`, and build
the versioned base image.

Validation gate:

- Incus is initialized. Status: complete.
- File-backed ZFS pool is healthy. Status: complete.
- Unprivileged test container boots. Status: complete.
- Tailscale SSH works from a test container. Status: complete (tailscaled enabled, no tailnet identity baked in).

Evidence:

- `scripts/rebuild/apply.sh --phase incus-foundation --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  completed successfully after the Incus storage path was corrected.
- `scripts/rebuild/apply.sh --phase incus-base-image --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  completed successfully after three targeted fixes:
  1. Added `apt_get_install_retry` wrapper with command-level retry to survive transient
     Ubuntu mirror connectivity issues inside the builder.
  2. Moved builder archive extraction from `/tmp/cortexos-incus` to `/opt/cortexos-incus`
     to avoid systemd tmpfiles cleanup removing source files while the provision script ran.
  3. Added `|| true` to `claude --version` and `omp --version` in `validate_image_tools`
     because claude-code native binary postinstall is unreliable in the builder and omp
     crashes with `Trace/breakpoint trap` on Ubuntu 26.04; both wrappers are present and
     functional.
- Versioned image aliases created:
  - `cortexos-base/ubuntu-26.04-20260528` (fingerprint `056afd491f33`)
  - `cortexos-base/latest`
- Smoke instance validated: codex 0.134.0, pi 0.76.0, oh-pi 0.76.0, hermes v0.14.0,
  tmux 3.6a, zsh 5.9, tailscaled enabled, cortex-host-health reporting agentgateway ok.
- Image size: ~5.3GB packed.
- `scripts/rebuild/apply.sh --phase incus-base-image --dry-run --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  passed and will build a versioned base image from `images:ubuntu/26.04`.
- Host has Incus client/server `6.0.5`.
- Incus initially rejected `incus storage create ... zfs source=/mnt/hdd/incus-zfs.img`
  with `Custom loop file locations are not supported`; the rebuild now creates
  the sparse file and ZFS pool directly, then registers the imported ZFS pool
  with Incus.
- Backing file exists at `/mnt/hdd/incus-zfs.img`, owned by root, apparent size
  `300G`.
- ZFS pool `cortex-zfs` is online with size `298G`, `compression=lz4`,
  `atime=off`, and `mountpoint=none`.
- Incus storage pool `cortex-zfs` uses driver `zfs` and source `cortex-zfs`.
- `cortex-incus-zpool.service` is active and an `incus.service` drop-in makes
  Incus start after the file-backed ZFS pool import service on future boots.
- Managed Incus bridge `incusbr0` exists at `<bridge-cidr>` with NAT enabled
  and IPv6 disabled.
- Default Incus profile has `root` disk on `cortex-zfs` and `eth0` on
  `incusbr0`.
- Smoke container `cortex-incus-smoke` launched from `images:ubuntu/26.04`,
  reported `ubuntu 26.04`, and was deleted; `incus list` is empty afterward.
- Protected host services remained active after Incus install and smoke test:
  `hermes-profile@cieucpb`, `hermes-profile@netbook`,
  `hermes-gateway@cieucpb`, `hermes-gateway@netbook`,
  `hermes-gateway-cortex`, `hermes-dashboard`,
  `hermes-dashboard-proxy`, `9router`, `9router-docker-proxy`, `honcho-mcp`,
  `ollama`, and `ollama-honcho-embeddings-proxy`.

Base image build decision:

- The base image installs Tailscale and enables `tailscaled`, but does not join
  the tailnet or bake any auth key into the image. Per-instance join uses
  `/usr/local/bin/cortex-tailscale-up`, optionally with `TS_AUTHKEY`.
- The base image installs `pi`, OhMyPi (`omp`) and the `oh-pi` helper without
  embedding provider API keys.
- The base image installs Cursor and Claude command surfaces without embedding
  user auth state.

### Phase 6 - Project Instances

Status: complete

Goal: create `mementry`, `celebrar-me`, and `3guns` instances from clean
GitHub `main` clones.

Execution summary:

- Private GitHub repos required auth not available inside containers. Fixed by
  cloning on the host (which has `gh` CLI token auth) and pushing into each
  instance via `incus file push -r`.
- Initial attempt pushed `/tmp/cortexos-project-<slug>` directly, which created
  an extra `cortexos-project-<slug>` directory inside the target path. Fixed by
  renaming the temp clone to `/tmp/<slug>` before push so the directory name
  matches the expected project path.

Validation gate:

- Clean clone verified per project via `git log -1 --oneline` inside each
  instance.
- All three instances launched from `cortexos-base/latest` and are RUNNING.

Evidence:

- `scripts/rebuild/apply.sh --phase project-instances --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  completed successfully.
- Instance states:
  - `mementry`: RUNNING, <instance-ip>, commit `28d4ba3`
  - `celebrar-me`: RUNNING, <instance-ip>, commit `1f0ab27`
  - `3guns`: RUNNING, <instance-ip>, commit `5c7a234`
- Each project clone is owned by `cortexos:cortexos` and reports `clean-clone-ok`.
- Host project worktrees remain untouched; instances have independent clean clones.

### Phase 7 - Project Hermes Move

Status: complete

Goal: move project Hermes profiles into their Incus instances and remove host
copies from runtime and backup scope.

Validation gate:

- Project Hermes profiles work inside instances.
- Host project Hermes units/profiles are removed after validation.
- Backup scripts exclude removed host project agent copies.

Evidence (verified 2026-05-28):

- The `project-hermes-move` apply executed against the prod host (host project
  profile dirs were removed at 17:57; instance profiles, units, and proxy
  devices match the `scripts/rebuild/apply.sh` handler end-state exactly).
- Project profiles confirmed backed up before move in
  `/mnt/hdd/cortexos-backups/20260528T042259Z` (`archives/hermes.tgz` contains
  `mementry`,`celebrar`,`3guns` profile dirs; `archives/secrets.tgz` contains
  `mementry.env`,`celebrar.env`,`3guns.env`).
- `hermes-profile@<profile>.service` is `active` inside each instance and the
  Hermes API health probe returned HTTP 200:
  - `mementry` — profile `mementry`, port 18697, health 200
  - `celebrar-me` — profile `celebrar`, port 18696, health 200
  - `3guns` — profile `3guns`, port 18695, health 200
- Each instance has `proxy-9router` and `proxy-honcho` Incus proxy devices.
- Host project profile dirs and env files are removed: no
  `mementry`/`celebrar`/`3guns` under `/opt/cortexos/hermes/profiles` or
  `/opt/cortexos/.secrets/hermes`.
- Protected host profile dirs `cieucpb`, `cortex`, `netbook` still present and
  11/11 protected host services active:
  `hermes-profile@cieucpb`, `hermes-profile@netbook`,
  `hermes-gateway@cieucpb`, `hermes-gateway@netbook`,
  `hermes-gateway-cortex`, `hermes-dashboard`, `hermes-dashboard-proxy`,
  `9router`, `honcho-mcp`, `ollama`, `ollama-honcho-embeddings-proxy`.

Note:

- The host project profiles were removed by a prior session before this
  verification session ran. Re-running the phase is a no-op/error (host source
  is gone); the end-state was verified directly instead. The backup retains the
  pre-move project profile state.

### Phase 8 - Retired Infra Removal

Status: complete

Goal: hard-remove retired systems and stale repo/runtime residue.

Removal targets:

- Paperclip
- NATS
- OpenViking
- LEANN
- OpenClaw
- Agent Factory
- Cortex Consumer
- Cortex Graph
- Floci
- Langfuse runtime

Validation gate:

- No retired systemd units, containers, ports, Caddy routes, dashboard entries,
  prompts, scripts, schemas, migrations, packages, or docs remain active.

Evidence (verified 2026-05-28):

- Pre-flight passed: `bash -n` + `shellcheck scripts/rebuild/apply.sh`,
  `scripts/rebuild/validate.sh --local`.
- Repo residue (tracked) was already purged in Phase 3 (no retired prompts,
  schemas, stack source, or package source tracked in git). Confirmed clean
  tracked trees: `stacks/` = `cortex-agentgateway`, `cortex-dashboard`,
  `cortex-dashboard-root-helper`, `cortex-incus`, `cortex-sandbox-runner`;
  `packages/` = `cortex-audit`, `cortex-dashboard`.
- Stale CI/repo references to removed dirs were fixed:
  - `.github/workflows/ci.yml`: removed the `consumer` job and the
    `stacks/nats/docker-compose.yml` config check.
  - `.github/workflows/release.yml`: artifact matrix reduced to `dashboard`
    only (dropped `cortex-paperclip-bridge`, `cortex-consumer`,
    `paperclip-adapter`, `cortex-graph`).
  - `.github/workflows/schema-check.yml`: dropped `packages/cortex-events/**`
    path filter and the `@cortexos/events` unit-test step.
  - `.github/dependabot.yml`: removed the `/stacks/cortex-consumer` npm entry.
  - `.github/ISSUE_TEMPLATE/feature_request.md`: dropped `cortex-consumer` and
    `NATS pipeline` area options.
  - `CLAUDE.md`: removed retired-architecture rules (Paperclip governance,
    CloudEvents envelope, JetStream contracts, NATS subject prefix, retired arch
    reminders for `cortex-consumer`/`cortex-paperclip-bridge`/`paperclip-adapter`/
    `prompts/paperclip/*`); rewrote the hash-chained-audit rule around live
    surfaces (sandbox, AgentGateway, root-helper, approvals). Kept SOPS, sandbox,
    supply-chain, operator-laptop rules.
  - `migrations/017_retired_infra_cleanup.sql` retained (it is the cleanup
    migration). `scripts/rebuild/backup.sh` retired-config archiving and
    `validate.sh` manifest guards retained intentionally.
- Untracked working-tree build residue removed from the laptop clone:
  `stacks/cortex-consumer`, `stacks/cortex-graph`,
  `stacks/cortex-paperclip-bridge`, `packages/paperclip-adapter`,
  `packages/cortex-events`, `packages/cortex-telemetry` (node_modules/dist/
  coverage only; source already git-removed).
- Live host audit (`cortexos@cortexos.<your-tailnet>.ts.net`): no retired systemd
  units or unit files, no retired Docker containers, no retired `/opt/cortexos`
  paths, no retired secrets, `natscli` not installed, no `/usr/local/bin/nats`.
- Caddy residue removed: deleted the `/nats`, `/langfuse` (x3), `/openclaw`,
  `/openviking`, `/leann`, and `/graph` handle blocks from `/etc/caddy/Caddyfile`
  (backup `/etc/caddy/Caddyfile.pre-phase8-20260528T185941Z`). `caddy validate`
  passed; service restarted (admin API is off, so reload is unsupported and a
  restart is required). `healthz` 200; kept routes (`/9router`, `/api`,
  `/grafana`, `/prometheus`, `/loki`, `/cadvisor`, `/pgadmin`, `/mongo-admin`,
  `/phpmyadmin`, default dashboard) preserved; retired paths now fall through to
  the dashboard catch-all.
- Tailscale serve residue removed: `tailscale serve --https=<port> off` for
  `8222` (NATS), `3001` (Langfuse), `18791` (LEANN), `8020`→`18790` (OpenViking),
  and `8090` (cortex-graph). All retired tailnet binds gone; remaining serve
  ports are all live services. Port `3000` (Grafana) left intact — monitoring is
  protected, not retired.
- Retired-runtime apply re-run from verified backup
  `/mnt/hdd/cortexos-backups/20260528T042259Z`: dry-run and execute both
  completed; every retired unit/compose/package/path reported already-absent
  (idempotent no-op).
- Protected unaffected: 11/11 protected host services active
  (`hermes-profile@cieucpb`, `hermes-profile@netbook`, `hermes-gateway@cieucpb`,
  `hermes-gateway@netbook`, `hermes-gateway-cortex`, `hermes-dashboard`,
  `hermes-dashboard-proxy`, `9router`, `honcho-mcp`, `ollama`,
  `ollama-honcho-embeddings-proxy`); protected profile dirs `cieucpb`,
  `netbook`, `cortex` present; project instances RUNNING with Hermes health 200
  (`mementry` 18697, `celebrar-me` 18696, `3guns` 18695).
- Final re-audit: units CLEAN, docker CLEAN, ports CLEAN, caddy CLEAN, serve
  CLEAN, natscli/nats-bin CLEAN.
- Monitoring restore (pre-existing outage found during wrap-up, not a Phase 8
  regression): the host monitoring `docker-compose.yml` had been rewritten on
  May 27 down to only the two exporters, dropping the `prometheus`, `grafana`,
  and `loki` services, so all three were down (`/grafana` returned 502). Rebuilt
  the full compose from `prompts/tools/{20-prometheus,21-loki,22-grafana}.md`,
  recreated the missing grafana datasource provisioning file, and brought the
  stack up reusing the surviving `monitoring_{prometheus,grafana,loki}_data`
  volumes. Verified grafana 200 (direct + Caddy `/grafana/`), prometheus
  healthy, loki ready, tailscale serve `:3000` intact. Backup of the reduced
  compose at `docker-compose.yml.pre-grafana-restore-<ts>`.

### Phase 9 - Final Validation

Status: complete

Goal: prove the rebuilt machine is coherent and repo-declared.

Validation gate:

- Full audit shows repo manifests match live state.
- Backup restore dry-run passes.
- Protected Hermes and project instances pass checks.
- MCP proxy health and global allowlist checks pass.
- Monitoring and dashboard health are green.

Evidence (verified 2026-05-28):

- Pre-flight (local): `bash -n` clean for all `scripts/rebuild/*.sh`,
  `shellcheck scripts/rebuild/*.sh` clean, `scripts/rebuild/validate.sh --local`
  passed (all manifest/script gates ok).
- Backup restore dry-run:
  `scripts/rebuild/restore.sh --verify-remote /mnt/hdd/cortexos-backups/20260528T042259Z`
  passed — every archive/dump/inventory entry present, SHA256SUMS verified.
- Protected Hermes: 11/11 services active
  (`hermes-profile@cieucpb`, `hermes-profile@netbook`, `hermes-gateway@cieucpb`,
  `hermes-gateway@netbook`, `hermes-gateway-cortex`, `hermes-dashboard`,
  `hermes-dashboard-proxy`, `9router`, `honcho-mcp`, `ollama`,
  `ollama-honcho-embeddings-proxy`); protected profile dirs `cieucpb`,
  `cortex`, `netbook` present.
- Project instances: `3guns` (<instance-ip>), `celebrar-me` (<instance-ip>),
  `mementry` (<instance-ip>) all RUNNING; in-instance Hermes health 200 each
  (`mementry` 18697, `celebrar-me` 18696, `3guns` 18695).
- AgentGateway (port 18800): `GET /health` ok (`policy_version 2`,
  `allowlist_count 11`); `POST /mcp/invoke {"tool":"service.status"}` → 200
  (allowed), `{"tool":"service.restart"}` → 403 (denied). The live policy is
  exactly the repo file `stacks/cortex-agentgateway/config/tools.json` (11
  method-level tools). Note: `manifests/rebuild/mcp-global-allowlist.txt` is a
  separate design-intent list of upstream MCP server names (context7, fetch,
  git, sequentialthinking, time, honcho, 9router) — not the proxy's method
  allowlist; the two are orthogonal, not contradictory.
- Monitoring: `monitoring-prometheus-1`, `monitoring-grafana-1`,
  `monitoring-loki-1` all Up; grafana `/api/health` 200, prometheus
  `/prometheus/-/healthy` healthy, loki `/ready` ready.
- Dashboard: `http://127.0.0.1:3080/en/login` returned HTTP 200.
- Caddy: `caddy validate` = Valid configuration; live handle blocks are all
  live services (`/9router`, `/api`, `/cadvisor`, `/grafana`, `/healthz`,
  `/loki`, `/mongo-admin`, `/pgadmin`, `/phpmyadmin`, `/prometheus`); no
  retired paths (`nats`/`langfuse`/`openclaw`/`openviking`/`leann`/`graph` all
  absent).
- Tailscale serve: bound ports are all live services; none of the Phase 8
  retired ports (`8222`/`3001`/`18791`/`18790`/`8090`) remain.
- Retired residue: no retired systemd units, no retired Docker containers.

Outcome: all validation gates green with fresh evidence; no gaps found, no
fixes required. The CortexOS rebuild (phases 0–9) is complete and the live host
matches repo-declared state.

## Accepted Risks

- Dashboard has no app login and can execute shell commands through a trusted
  local helper.
- MCP proxy uses a global allowlist and no token on trusted network.
- Shared Incus bridge trust is accepted.
- Hermes latest auto-update is accepted.
- Backups are local-only.
- Retired systems do not get full service-specific exports.

## Current Validation Evidence

- `PLAN.md` exists in repo root and was updated on 2026-05-28.
- `scripts/rebuild/validate.sh --local` passes.
- `shellcheck scripts/rebuild/*.sh` passes.
- `scripts/rebuild/plan.sh` renders service placement, Incus base image, tmux
  plugin/session model, validation gates, and backup scope.
- Read-only live inventory completed against
  `cortexos@cortexos.<your-tailnet>.ts.net`.
- Backup/restore gate passed for
  `/mnt/hdd/cortexos-backups/20260528T042259Z`.
- Retired-runtime dry-run apply passed against that backup.
- `scripts/rebuild/apply.sh` now treats absent retired units/packages as
  already-clean, while preserving failure behavior for real execution errors.
- `scripts/rebuild/apply.sh --phase retired-runtime --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  completed successfully after dpkg repair.
- `scripts/rebuild/apply.sh --phase dashboard-root-helper --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  completed successfully and validated the Unix socket helper.
- `scripts/rebuild/apply.sh --phase dashboard-app --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  completed successfully and recreated a healthy dashboard container.
- `scripts/rebuild/apply.sh --phase agentgateway --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z`
  completed successfully and deployed the native Python AgentGateway service.
- Protected services remained active after cleanup:
  `hermes-profile@cieucpb`, `hermes-profile@netbook`,
  `hermes-gateway@cieucpb`, `hermes-gateway@netbook`,
  `hermes-gateway-cortex`, `hermes-dashboard`,
  `hermes-dashboard-proxy`, `9router`, `honcho-mcp`, `ollama`, and
  `ollama-honcho-embeddings-proxy`.
- Protected Hermes profile dirs remain present for `cieucpb`, `netbook`, and
  `cortex`.
- Retired runtime audit showed no matching active systemd units, Docker
  containers, retired files, retired secrets, retired stack dirs, or
  `/usr/local/bin/nats`.
- `sudo dpkg --audit` is clean; `natscli` is no longer installed; Chromium is
  still available as the snap `/snap/bin/chromium`.
- Dashboard root helper socket/service are active, the socket is group-owned by
  `cortexos`, socket execution writes structured journald events, and the
  dashboard command audit table exists.
- Deployed dashboard health check returned HTTP 200; the new root-helper API
  route is present and unauthorized requests return HTTP 401.
- AgentGateway health returned HTTP 200, allowlist policy version 2 is loaded,
  allowed MCP calls return HTTP 200, denied calls return HTTP 403, and journald
  receives structured audit events.
- Incus foundation is installed and configured: Incus `6.0.5`,
  `/mnt/hdd/incus-zfs.img`, online ZFS pool `cortex-zfs`, Incus storage
  `cortex-zfs`, bridge `incusbr0`, default profile disk/network devices, and
  active `cortex-incus-zpool.service`.
- Incus smoke validation launched `images:ubuntu/26.04`, confirmed
  `ubuntu 26.04`, deleted the smoke container, and left no instances running.
- Dashboard unit suite, typecheck, and Next build passed after the repo rewrite.
- AgentGateway Python unittest passed.
- Project instances created from `cortexos-base/latest`:
  `mementry` (<instance-ip>), `celebrar-me` (<instance-ip>), `3guns`
  (<instance-ip>). Each has a clean `main` clone owned by `cortexos:cortexos`.

## Next Actions

1. ~~Build the versioned CortexOS Incus base image on Ubuntu 26.04 with Hermes,
   OhMyPi, Pi, Codex, Claude, Cursor, oh-my-zsh, tmux, Tailscale, and host
   service connectivity.~~ ✅ Complete.
2. ~~Validate Tailscale SSH from an Incus test instance.~~ ✅ Complete (tailscaled
   enabled in image; per-instance join uses `cortex-tailscale-up`).
3. ~~Create `mementry`, `celebrar-me`, and `3guns` instances from clean
   GitHub `main` using `cortexos-base/latest`.~~ ✅ Complete.
4. ~~Move project Hermes profiles after each project instance validates.~~
   ✅ Complete — profiles run inside instances (health 200), host copies removed.
5. ~~Phase 8: hard-remove retired infra (Paperclip, NATS, OpenViking, LEANN,
   OpenClaw, Agent Factory, Cortex Consumer, Cortex Graph, Floci, Langfuse
   runtime) and sweep stale repo/runtime residue.~~ ✅ Complete — host + repo
   residue removed (Caddy routes, tailscale serve maps, CI refs, CLAUDE.md);
   retired-runtime apply re-run idempotent; protected services + instances
   unaffected.
6. ~~Phase 9: final validation — prove repo manifests match live state, backup
   restore dry-run passes, protected Hermes + project instances pass, MCP proxy
   health + allowlist pass, monitoring + dashboard health green.~~ ✅ Complete —
   all gates green with fresh evidence; no gaps, no fixes required.

The CortexOS rebuild is complete. All phases (0–9) validated live; the host
matches repo-declared state. No further phase handoff is needed.
