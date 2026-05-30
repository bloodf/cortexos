# CortexOS Handoff — Phase C: Host-Side Reconciliation

> **Operator session notes — historical record, not install instructions.**

Generated: 2026-05-28
Workspace: `/Users/heitor/Developer/github.com/bloodf/cortexos`
Supersedes nothing; this is the next work item after the repo↔host reconciliation
Phases A + B (both complete).

## How To Use This Handoff

Start a **fresh session** and paste:

> Continue CortexOS host reconciliation. Read `docs/rebuild/handoff-2026-05-28-phaseC-host-reconciliation.md` and `docs/rebuild/RECONCILIATION.md`, then execute Phase C. Prod SSH approval needed up front. Start with the low-risk wins (C5 dead-unit cleanup, C2 port conflict), then plan C1/C3/C4 (live data) before acting.

## Where Things Stand (verified 2026-05-28)

The CortexOS rebuild (phases 0–9) is complete and validated. A follow-up
three-way audit (repo OSS-readiness / dashboard correctness / live-host drift)
found the laptop repo `main` was a **thinner slice** than the running host.
Reconciliation decisions + full gap inventory live in
`docs/rebuild/RECONCILIATION.md` (read it first — it is the canonical plan).

### Repo work DONE this round (all on `main`, pushed)

- `2f3aec9` — Recon Phase A: OSS-readiness fixes + dashboard catalog/seed bugs.
- `96fa8ed` — B1: imported cortex ops features (auto-update, 9router-health,
  degraded-service-watcher, backup) → `scripts/ops/`, `templates/systemd/`,
  `prompts/tools/90-cortex-ops.md`.
- `9e32f25` — B3/B4/B5: 12 service install prompts + dynamic-seed spoke keys.
- `4a2de9b` — B2: full cortex-mail-guardian feature (package + UI + 4 migrations
  020–023 + units + prompt 82).
- `b42419d` — plan status update.

All repo gates green: `validate.sh --local`, dashboard 558 tests + tsc + next
build, mail-guardian package 12 tests.

### What is NOT done — Phase C (this handoff). All host-side, touches prod.

Repo now *declares* the features, but the live host still has drift the repo
cannot fix safely from the laptop. Operator decision (2026-05-28) was: **defer
data-plane, document only** — that deferral is what Phase C executes.

## Critical Safety Constraints (unchanged)

- **Never touch protected Hermes identities `cieucpb`, `netbook`, `cortex`** or
  their services/profile dirs.
- Never touch the three project instances (`mementry`, `celebrar-me`, `3guns`)
  or their in-instance Hermes profiles.
- **Phase C C1/C3 touch LIVE DATABASES** (postgres/mysql/mongo with real data).
  Back up first, act reversibly, verify after each step. Do NOT bulk-delete.
- Optional features install only when the operator opts in **interactively** —
  no assumed env vars (standing operator directive).

## Prod Access

- Host: `cortexos@cortexos.<your-tailnet>.ts.net` (real tailnet ID is in the
  operator's SSH config / `scripts/rebuild/lib.sh` requires `CORTEX_HOST` env).
- The Claude Code auto-classifier re-blocks prod SSH at session start — ask the
  operator to approve prod SSH before any host work.
- Orchestrator does all git; never run git from the host.

## The Three Source Trees (root cause of drift)

| Tree | State | Role |
|------|-------|------|
| Laptop repo `main` | clean; now declares ops + mail-guardian + all prompts | source of truth |
| `/opt/cortexos` | **not a git repo**; 21 stacks; unversioned | live runtime |
| `/home/cortexos/Developer/github.com/cortexos` | old `main` @ `16adbd4`, **dirty**, 59 retired files (paperclip/floci/langfuse) | **still serves 6 prod data-plane stacks** |

## Phase C Work Items (from RECONCILIATION.md)

### C5 — dead-unit cleanup (LOW RISK, do first)

`cortex-synthetic@.service` + `.timer` are still **enabled** on the host but
depend on retired `nats.service` + `cortex-consumer.service` and `nats pub` to a
dead bus. The repo deliberately did NOT import them.
- Action: `systemctl disable --now cortex-synthetic@*.timer cortex-synthetic@*.service`
  (enumerate instances first), remove the unit files
  `/etc/systemd/system/cortex-synthetic@.{service,timer}` and
  `/usr/local/bin/cortex-synthetic-publish.sh`, `daemon-reload`.
- Verify: no `cortex-synthetic` units remain; nothing else referenced them.

### C2 — cockpit ↔ prometheus :9090 conflict (LOW/MED RISK)

Both bind `127.0.0.1:9090` on the live host. Cockpit is on 9090 (standard),
Prometheus container also maps 9090. The dashboard seed still lists cockpit at
`tcp:9093` (a guess) with a `port under reconciliation` comment (added in
commit `2f3aec9`).
- Action: decide canonical ports. Cleanest: move Cockpit to `9091` (or move
  Prometheus host-publish), update the live bind, update Caddy/tailscale-serve if
  affected, then fix the dashboard cockpit health row + any prompt
  (`prompts/tools/*cockpit*` if one is later authored) to the real port and drop
  the reconciliation comment.
- Verify: both reachable on distinct ports; dashboard healthcheck green.

### C1 — data-plane off the stale old clone (HIGH RISK, plan before acting)

These prod compose stacks are served from the **old dirty clone**
`/home/cortexos/Developer/github.com/cortexos/stacks/` (per `docker compose ls`):
postgresql, mysql (one of two compose files), mongodb, pg-exporter,
redis-insight, watchtower. The clone also holds 59 retired files.
- Goal: move each compose into repo-declared `/opt/cortexos/stacks/<svc>` (and
  add/confirm a matching `prompts/tools/*` install prompt — most now exist from
  B3), bring the stack up from the new location reusing existing named volumes
  (NO data loss), confirm healthy, then retire the old clone.
- Caution: these hold live databases with real project data. Per-stack: snapshot
  the named volumes first, compose down from old path, compose up from new path
  pointing at the SAME volumes, health-check, only then remove old clone files.
- The repo backup tool `scripts/ops/cortex-backup.sh` (imported B1) dumps
  postgres/mysql/mongo/redis — run it before starting.

### C3 — host-resident project docker stacks vs Incus instances

Project compose stacks still **running on the host**: `api`/mementry
(`/home/cortexos/Developer/github/bloodf/mementry/...`), `celebrarme-laravel`,
`mementry-mementry-local`. PLAN said host project worktrees were archived +
removed after Incus instance validation. They are duplicated (instances RUNNING
with Hermes health 200 already).
- Action: confirm the Incus instances fully cover these, then tear down the
  host-side project compose + worktrees (archive to `/mnt/hdd/cortexos-backups`
  first). Operator decision needed on whether any host-side project stack must
  stay.

### C4 — make `/opt/cortexos` reproducible from repo

`/opt/cortexos` is not version-controlled; runtime config exists only on the
host. The bootstrap flow (`prompts/00-bootstrap.md` + `scripts/bootstrap.sh`)
pushes the repo to the host, but ad-hoc host edits drift back out of git.
- Action: define the materialization contract — what under `/opt/cortexos` is
  repo-owned (overwrite on deploy) vs host-owned (secrets, data, logs). Add a
  drift-check (e.g. `scripts/rebuild/validate.sh` extension or a new
  `scripts/ops/drift-check.sh`) comparing live `/opt/cortexos/stacks/*` +
  `/etc/systemd/system/cortex-*` against repo `stacks/` + `templates/systemd/`.

## Suggested Order

1. Get prod SSH approval.
2. C5 (dead units) — quick, reversible.
3. C2 (port conflict) — small, verify dashboard health after.
4. Run `cortex-backup.sh` (or the rebuild backup gate) → fresh verified backup.
5. C1 per-stack, one DB at a time, volume-preserving, verify each.
6. C3 after confirming instances cover projects.
7. C4 drift-check tooling last (codifies the new steady state).
8. Update `RECONCILIATION.md` Phase C items to ✅ with evidence; commit.

## Key Files

- `docs/rebuild/RECONCILIATION.md` — canonical plan (gaps G1–G6, phases A/B/C).
- `scripts/ops/cortex-backup.sh` — backup before C1.
- `scripts/rebuild/validate.sh`, `scripts/rebuild/restore.sh`.
- `prompts/tools/_order.md` — current install-spoke graph (incl. new prompts).
- Host: `/opt/cortexos/stacks/`, `/home/cortexos/Developer/github.com/cortexos/`
  (old clone), `/etc/systemd/system/cortex-*`.

## Open TODO carried from B5

`packages/cortex-dashboard/scripts/dynamic-seed.js` has 4 spoke entries tagged
`// TODO: confirm spoke key`: `incus`, `webmin`, `cockpit`, `watchtower` — core
always-on services with no numbered install prompt. Decide whether to author
prompts for them or move to an explicit always-active allowlist.
