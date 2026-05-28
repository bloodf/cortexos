# CortexOS Repo ↔ Host Reconciliation Plan

Created: 2026-05-28
Owner: operator
Status: Phases A, B, and C complete. Phase A+B commits: 2f3aec9, 96fa8ed, 9e32f25, 4a2de9b. Phase C (2026-05-28): C2 cockpit-port `34d3c9d`; C1/C3/C4 host reconciliation executed live (old clone retired, host project stacks torn down, drift-check tooling added).

## Why this exists

After the phase 0–9 rebuild, a full three-way audit (repo OSS-readiness,
dashboard correctness, live host drift) found the laptop repo `main` is a
**thinner slice** than what actually runs on the host. The host carries working
features the rebuild branch dropped. This plan reconciles them.

### Decisions (operator, 2026-05-28)

1. **Direction: expand repo to match host.** The repo becomes the true
   source-of-truth by re-declaring the good live features, so a fresh machine
   reproduces what runs now.
2. **Personal/host apps (Jellyfin, Home Assistant, Dockhand, kernel-browser):
   include as _optional_ install prompts.**
3. **Data-plane reconciliation off the stale old clone: defer + document only**
   (touches live databases — separate careful task).
4. **Optional installs must prompt the operator interactively. Never assume
   pre-set env vars exist.** Every optional prompt asks for its config at run
   time (with sane defaults offered, but confirmed by the operator), rather than
   reading an env var that may be unset.

## Three divergent source trees (root cause)

| Tree | State | Role |
|------|-------|------|
| Laptop repo `main` (rebuild) | clean; 5 stacks + 22 tool prompts | intended SoT |
| `/opt/cortexos` | **not a git repo**; 21 stacks + extra dirs; unversioned | live runtime |
| `/home/cortexos/Developer/github.com/cortexos` | old `main` @ `16adbd4`, **dirty**, 59 retired files (paperclip/floci/langfuse) | **still serves 6 prod data-plane stacks** |

The old clone is the *source* for the dropped install prompts and several live
docker stacks — it is both the recovery source (for re-import) and a hazard
(stale, retired-laden, serving prod data).

## Gap inventory

### G1 — Dropped working features (live on host, absent from repo)

Run live, source in old clone + `/opt/cortexos`, **not in laptop repo**:

- `cortex-mail-guardian` — IMAP AI listener; package `cortex-mail-guardian`
  (`/opt/cortexos/packages/cortex-mail-guardian`) + `cortex-mail-guardian.service`
  + `cortex-mail-guardian-sweep.{service,timer}` + dashboard pages/APIs
  (`[locale]/mail-guardian/*`, `api/mail-guardian/*`, admin panels, widget).
- `cortex-auto-update.{service,timer}` → `/opt/cortexos/scripts/cortex-auto-update.sh`
  (6964 B) — **this is the operator's "update checks".**
- `cortex-degraded-service-watcher.{service,timer}` →
  `/opt/cortexos/scripts/cortex-degraded-service-watcher.mjs` (8459 B) — **AI
  "healthcheck" watcher.**
- `cortex-9router-health.{service,timer}` →
  `/usr/local/sbin/cortex-9router-healthcheck.sh` (1456 B).
- `cortex-synthetic@.{service,timer}` →
  `/usr/local/bin/cortex-synthetic-publish.sh` (364 B).
- `cortex-backup.{service,timer}` → `/opt/cortexos/scripts/cortex-backup.sh`
  (9712 B). (Repo has `scripts/rebuild/backup.sh`, a different rebuild-time tool.)
- `9router-docker-proxy.service`, drop-ins for several units.

13 unit files total to import + 3 standalone scripts + 1 package + dashboard UI.

### G2 — Missing install prompts (running, no repo prompt → fresh machine can't reproduce)

Present in **old clone** `prompts/tools/`, dropped from rebuild:

- `16a-mysql.md` (PLAN *declares* MySQL but rebuild has no prompt)
- `32-honcho.md`, `42-hermes-honcho.md`
- `56-pgadmin.md`, `58-mongo-express.md`, `59-phpmyadmin.md`
- `25-node-exporter.md`, `26a-otel-collector.md`
- `27-dockhand.md` (optional), `14a-home-assistant.md` (optional),
  `14b-jellyfin.md` (optional)
- `82-mail-guardian.md`
- Plus extra exporters running with no prompt: pg / redis / mongo / snmp /
  adguard exporters.

### G3 — Declared-but-absent (stale repo claims)

- PLAN "Key Architecture Decisions" lists **MinIO + RabbitMQ** as host
  control-plane → neither runs as cortex infra. Remove or mark aspirational.
- Prompt `24-cadvisor.md` exists; **cadvisor container is not running** → Caddy
  `/cadvisor` route + dashboard catalog row are dead.
- Prompts `25-node-exporter`, `23-fluent-bit` exist; not running (`:9100` dead).

### G4 — Dashboard catalog/seed bugs (repo-only, safe to fix)

From the dashboard audit (`packages/cortex-dashboard`):

- **[HIGH]** `opik` missing from `migrations/017_retired_infra_cleanup.sql`
  DELETE lists — retired but not cleaned.
- **[HIGH]** `mongo-express` health URL wrong: seed uses `:8081`; live host port
  is `:8083` (→ container 8081). Fix `002_seed.sql` + `015_service_health_targets.sql`.
- **[HIGH]** `cadvisor` health `:8081/cadvisor/healthz` — collides with
  mongo-express AND cadvisor isn't running. Mark cadvisor optional/inactive.
- **[MEDIUM]** `mongo-express` `open_url` = `/mongo-express/` but live Caddy
  route is `/mongo-admin`. Reconcile (new migration 019 + catalog fn).
- **[MEDIUM]** `dynamic-seed.js` `SPOKE_TO_SERVICES` missing ~16 services →
  any unmapped slug is forced `is_active=false` on a fully-provisioned host.
- **[MEDIUM]** `cockpit` health `tcp :9093` — live cockpit is `:9090` (which
  itself collides with Prometheus on loopback — host port mess, see G5).
- **[MEDIUM]** migration numbering gaps (005–007, 016 no stub).
- **[LOW]** no test asserts retired-absent / live-present catalog integrity.

### G5 — Host-state messes (document, fix carefully later)

- **Cockpit and Prometheus both bind `127.0.0.1:9090`** — port conflict on the
  live host. Needs a port reassignment decision before the seed can be correct.
- Project docker stacks (`api`/mementry, `celebrarme-laravel`, `mementry-local`)
  **still running on host** despite Incus migration — PLAN said host worktrees
  removed after instance validation. Duplication; decide teardown vs keep.
- `/opt/cortexos` is not version-controlled; config lives only on the host.

### G6 — OSS-readiness issues (repo-only, safe to fix)

From the repo audit:

- **[CRITICAL-lowrisk]** live tailnet ID `<your-tailnet>` + Incus IPs `10.222.222.x`
  committed in `PLAN.md` + `docs/rebuild/handoff-*.md`. Redact for public.
- **[HIGH]** `scripts/rebuild/lib.sh:6` hardcodes
  `cortexos@cortexos.<your-tailnet>.ts.net` as default — require env, no fallback.
- **[HIGH]** `scripts/rebuild/apply.sh:701-705` hardcodes `bloodf` org path →
  parameterize `${CORTEX_GH_ORG:-bloodf}`.
- **[HIGH]** `README.md` too thin — no pitch, prerequisites, bootstrap flow,
  license/contributing links.
- **[HIGH]** `.github/ISSUE_TEMPLATE/agent-task.md` references NATS + dangling
  `docs/runbooks/CI_POLICY.md`.
- **[HIGH]** workflow headers (agent-mention-router, gate-enforcement,
  workflow-pipeline) cite "NATS event bus"; reference non-existent
  `bootstrap-project.sh`.
- **[MEDIUM]** `CLAUDE.md:41` → `templates/agent-roles/` doesn't exist.
- **[MEDIUM]** `backup-scope.tsv` absolute laptop path; `projects.tsv` personal
  repos unlabeled; JetStream comment in `confirmation-token.ts`; Ubuntu version
  inconsistency (README 26.04 vs os-detect 24.04/25.x); `SECURITY.md` lacks
  reporting channel; root `package.json` lacks `"license"`; `docs/README.md`
  index incomplete; handoff docs need tombstone headers.
- **[LOW]** empty untracked dirs (`templates/agent-workflows`,
  `templates/cortex-orchestration`, `scripts/smoke`); thin `CONTRIBUTING.md`.

## Execution phases

### Phase A — repo-only safe fixes (NO host risk) — DONE (commit 2f3aec9)

A1. OSS-readiness fixes (G6). ✅
A2. Dashboard catalog/seed bugs (G4, the verified-port subset). ✅

Both were repo edits, reviewed via tests/build; no live mutation.

### Phase B — import live features into repo (G1 + G2) — DONE

Commits: B1 `96fa8ed`, B3/B4/B5 `9e32f25`, B2 `4a2de9b`.
Re-imported from old clone + `/opt/cortexos`, de-retired, adapted to rebuild conventions:

- B1. cortex ops units + scripts → `scripts/ops/` + `templates/systemd/` +
  `prompts/tools/90-cortex-ops.md`. ✅ DONE. Imported + de-retired:
  cortex-auto-update (update checks), cortex-9router-health, cortex-degraded-
  service-watcher (AI health watcher), cortex-backup. **cortex-synthetic@ was
  NOT imported** — it is a pure NATS/cortex-consumer feature (both retired); it
  is dead residue still enabled on the host → see C5.
- B2. ✅ DONE. `cortex-mail-guardian` package + 3 systemd units + full dashboard
  UI (page/layout/3 API routes/3 admin panels/2 widgets) + 4 renumbered
  migrations (020 tables+catalog, 021 actions, 022 widgets, 023 action_log
  target) + nav/widget/action-log wiring + spoke `82-mail-guardian` + interactive
  `prompts/tools/82-mail-guardian.md`. Old `014_webui_app_registry_source` NOT
  imported (superseded + retired refs). 558 dashboard tests + 12 package tests +
  tsc + next build all green.
- B3. ✅ DONE. Required install prompts: `16a-mysql`, `32-honcho`,
  `42-hermes-honcho`, `56-pgadmin`, `58-mongo-express`, `59-phpmyadmin`,
  `25-node-exporter`, `26a-otel-collector`, `28-db-exporters` — de-retired,
  pkg.sh/CORTEX_OS_FAMILY, interactive.
- B4. ✅ DONE. Optional prompts: `14a-home-assistant`, `14b-jellyfin`,
  `27-dockhand` — interactive, marked OPTIONAL.

B5. ✅ DONE. **Reconciled `dynamic-seed.js` spoke keys** to real prompt
  filenames (dropped guesses). `incus`/`webmin`/`cockpit`/`watchtower` remain
  `// TODO: confirm spoke key` (core always-on, no numbered install prompt).
  Original note: Phase A2 added spoke mappings with *guessed* keys. Phase A2 added spoke→service
  mappings using *guessed* keys (`19-mysql`, `40-45`, etc.) because the real
  install prompts didn't exist yet. When B3 imports the actual prompts from the
  old clone, rename those keys to match the real prompt filenames
  (`16a-mysql`, `32-honcho`, `56-pgadmin`, `58-mongo-express`, `59-phpmyadmin`,
  `26a-otel-collector`, …) so `.setup-state.json` `completed_spokes` activates
  the right services. Guessed keys are tagged `// GUESSED:` in the file.

### Phase C — host-side reconciliation (COMPLETE 2026-05-28)

- C1. ✅ DONE. Repointed the data-plane off the stale old clone onto
  `/opt/cortexos/stacks`. Stacks moved: `postgresql`, `mongodb` (+mongo-express),
  `mysql` phpmyadmin sidecar, `redis-insight`, `pg-exporter`, `watchtower`
  (`cortex-mysql` was already on `/opt`). Compose files were byte-identical and
  project names = dir basenames, so each repoint was `down` (never `-v`) from the
  old path + `up` from `/opt` reusing the **same named volumes** — zero data
  movement. Per-stack quiescent volume snapshots taken to
  `/mnt/hdd/cortexos-backups/c1-<ts>/` before each `up`. Created missing
  `/opt/cortexos/.secrets/postgres.env` (old clone resolved it via a relative
  `../../.secrets` path); fixed root→cortexos ownership on `/opt` `mongodb.env`
  and `mysql.env`. Verified: postgres 44 services/55 migrations rows intact,
  mongo `listDatabases` ok, all containers healthy, redis-insight HTTP 200.
  Old clone `/home/cortexos/Developer/github.com/cortexos` (`16adbd4`, 59 retired
  files) archived to `c1-<ts>/old-cortex-clone-16adbd4.tar.gz` then removed; no
  systemd/cron/script/process referenced it. `docker compose ls` confirms no
  stack is served from the old clone.
- C2. ✅ DONE. Cockpit↔Prometheus `:9090` conflict already resolved on the host:
  `cockpit.socket.d/listen.conf` binds Cockpit to `127.0.0.1:9091`, Prometheus
  owns `127.0.0.1:9090`; both served via `tailscale serve` (9090/9091). Repo
  aligned: `002_seed.sql` cockpit health_url `9093`→`9091` (guess removed) +
  `024_cockpit_port_fix.sql` for provisioned DBs. Live DB verified already at
  `tcp://127.0.0.1:9091`; cockpit `:9091` reachable (HTTP 200).
- C3. ✅ DONE. Host-resident project app stacks (`api`/mementry,
  `celebrarme-laravel`, `mementry-mementry-local`, all under
  `/home/cortexos/Developer/github/bloodf/`) are duplicated by the running Incus
  instances (`3guns`, `celebrar-me`, `mementry`). Operator confirmed Incus
  coverage and approved teardown. All 8 project data volumes snapshotted to
  `/mnt/hdd/cortexos-backups/c3-<ts>/`; containers + project networks removed;
  `mementry` + `celebrar.me` worktrees archived (`worktree-*.tar.gz`, incl
  uncommitted changes + `.env`) then deleted (operator-confirmed despite 50+16
  uncommitted files). `3guns` worktrees left intact (protected project). Orphaned
  named volumes (`api_*`, `celebrarme-laravel_*`, `mementry-mementry-local_*`)
  preserved as a safety net — operator may `docker volume rm` them later.
- C4. ✅ DONE. Added `scripts/ops/drift-check.sh` (read-only; `--diff`,
  `--strict`). Encodes the materialization contract: repo-owned (`stacks/` →
  `/opt/cortexos/stacks`, `templates/systemd/` → `/etc/systemd/system`) must
  match; prompt-materialized data-plane stacks are reported `host-managed` not
  drift; secrets/data/logs are host-owned and never compared. Documented in
  `prompts/tools/90-cortex-ops.md`. First run found 3 control-plane composes
  match and 6 systemd units drift/missing — the live ops units predate the B1
  de-retired import, so the repo is now SoT and a redeploy converges them
  (follow-up, not a blocker).
- C5. ✅ DONE. Retired `cortex-synthetic@.service`/`.timer` residue (depended on
  retired `nats.service` + `cortex-consumer.service`, published to a dead NATS
  bus). Timer was already `disabled`, service `static`, zero active instances.
  Archived to `/mnt/hdd/cortexos-backups/c5-synthetic-<ts>` then removed the two
  units + `/usr/local/bin/cortex-synthetic-publish.sh`; `daemon-reload`. No
  residue remains. (Repo never imported them.)

### Phase C follow-ups (2026-05-28)

- **Backup DB-dump auth fixed** (`scripts/ops/cortex-backup.sh`, deployed to host
  `/opt/cortexos/scripts/cortex-backup.sh`): postgres/honcho/mongo/redis logical
  dumps now authenticate (run via in-container `sh -c` so credential env vars
  expand). The live `mysql_mysql_data` root password had drifted from
  `mysql.env` (env changed after volume init); reset to the env value via MySQL
  `--init-file`. **Verified end-to-end**: `sudo cortex-backup.sh` completes with
  zero dump failures and writes `/mnt/hdd/backups/2026-05-28_2259.tar.gz.age`
  (3.18 GB). Note the unit runs as **root** (no `User=`); run manual backups with
  `sudo`.
- **dynamic-seed always-active allowlist**: `dynamic-seed.js` now activates the
  core un-spoked services (`cortex-dashboard`, `incus`, `webmin`, `cockpit`,
  `watchtower`) regardless of `completed_spokes` (replaces 4 guessed spoke keys).
  Live DB still shows `cockpit`/`watchtower`/`webmin` `is_active=false` (the bug
  this fixes) — converges on next dashboard re-seed, or apply a one-off UPDATE.
- **systemd units drift = legacy `/opt` layout**: the host's `/opt/cortexos` was
  materialized by the pre-rebuild flow (flat `scripts/`, no `scripts/ops/`, units
  at `/usr/local/sbin` etc.). Repo paths converge on a bootstrap redeploy — not
  hand-patched on live units. `9router.service` template updated to the real
  working invocation (`9router --host 127.0.0.1 --port 11434 ...`; the old
  `cli.js`/"no `--port`" template was stale). `cortex-dashboard-env-writer.service`
  has no host analog (host uses `cortex-env-writer.sh` + active root-helper).
- **Orphaned C3 volumes** prunable after Incus coverage re-confirmed.

## Acceptance (when is this done)

- A fresh machine running `prompts/00-bootstrap.md` reproduces every non-optional
  live cortex service, including update checks, health watchers, backup, and
  mail-guardian.
- Optional services install only when the operator opts in interactively.
- Dashboard catalog/seed matches live ports/URLs; no retired rows; healthchecks
  green for all active services.
- No personal infra identifiers in public-facing files.
- The stale old clone no longer serves any live stack (Phase C).
