# CortexOS Rebuild Handoff — Phase 9: Final Validation

> **STATUS: COMPLETE (2026-05-28).** Phase 9 executed and all validation gates
> passed with fresh live evidence (see `PLAN.md` Phase 9 evidence block). The
> CortexOS rebuild (phases 0–9) is finished; no further phase handoff is needed.
> This document is retained for history.

Generated: 2026-05-28
Workspace: `/Users/heitor/Developer/github.com/bloodf/cortexos`
Supersedes: `handoff-2026-05-28-phase8-retired-infra-removal.md` (Phase 8 complete).

## How To Use This Handoff

Start a **fresh session** and paste:

> Continue the CortexOS rebuild. Read `docs/rebuild/handoff-2026-05-28-phase9-final-validation.md` and `PLAN.md`, then execute Phase 9 (final validation).

Canonical plan is `PLAN.md`; update it with evidence after the phase. One phase
per session, fresh context each time. Phase 9 is the **last** rebuild phase.

## Repo State (verified 2026-05-28)

- `main` is the rebuild. Phases 0–8 verified + committed.
- Old-architecture main preserved at remote branch
  `pre-rebuild-main-20260528` (recoverable, not merged).

## Status (from PLAN.md)

- Phases 0–8: **complete and validated live.**
  - Base image `cortexos-base/latest` (fp `056afd491f33`).
  - Project instances RUNNING with project Hermes profiles inside (health 200):
    `mementry` (18697), `celebrar-me` (18696), `3guns` (18695).
  - Retired infra fully removed: no retired units/containers/ports/Caddy
    routes/tailscale serve maps; repo CI + CLAUDE.md residue cleaned.
- **Phase 9 (final-validation): pending — this is the next and last step.**

## Phase 8 Outcome Note (read before Phase 9)

Phase 8 removed the last live residue the manifest did not cover:

- **Caddy** had stale `/nats`, `/langfuse`, `/openclaw`, `/openviking`,
  `/leann`, `/graph` handle blocks pointing at dead backends. Removed; service
  **restarted** (note: `admin off` in the Caddyfile means `caddy reload` fails
  with a 2019 connection-refused error — you must `systemctl restart caddy` to
  apply config changes). Backup at
  `/etc/caddy/Caddyfile.pre-phase8-20260528T185941Z`.
- **Tailscale serve** had stale maps for `8222`/`3001`/`18791`/`8020`→`18790`/
  `8090`. Removed with `tailscale serve --https=<port> off`. Port `3000`
  (Grafana) was deliberately kept — monitoring is protected, not retired.
- The `retired-runtime` apply itself was a clean idempotent no-op (everything
  was already absent from Phase 3).

**Lesson for Phase 9: the manifest-driven apply does not cover Caddy routes or
tailscale serve maps — audit those surfaces directly. Always verify live host
state first.**

## Critical Safety Constraints

- **Never touch protected Hermes identities `cieucpb`, `netbook`, `cortex`** or
  their services / profile dirs.
- Never touch the three project instances or their in-instance Hermes profiles.
- Phase 9 is validation-only — no destructive actions expected. If a gap is
  found, fix the smallest thing and re-verify; do not broaden scope.
- Do not mark the phase complete without fresh evidence.

## Prod Access

- Host: `cortexos@cortexos.<your-tailnet>.ts.net`.
- The Claude Code auto-classifier re-blocks prod SSH at session start. Ask the
  user to approve prod SSH for the session before host audits.

## Phase 9 Goal

Prove the rebuilt machine is coherent and repo-declared.

## Validation Gate — do not mark complete until all true

- Full audit shows repo manifests match live state (services catalog, ports,
  protected/retired manifests).
- Backup restore dry-run passes
  (`scripts/rebuild/restore.sh --verify-remote /mnt/hdd/cortexos-backups/20260528T042259Z`).
- Protected Hermes (`cieucpb`/`netbook`/`cortex`) and the three project
  instances pass checks.
- MCP proxy (`cortex-agentgateway`, port 18800) health + global allowlist
  checks pass (`GET /health` ok, allow/deny `POST /mcp/invoke`).
- Monitoring (Prometheus/Grafana/Loki) and dashboard health are green.
  Monitoring was restored at the end of Phase 8: the host
  `/opt/cortexos/stacks/monitoring/docker-compose.yml` had been rewritten
  (May 27) down to just the two exporters, dropping the `prometheus`, `grafana`,
  and `loki` service definitions, so all three were down. The full compose was
  rebuilt from `prompts/tools/{20-prometheus,21-loki,22-grafana}.md`, the
  missing grafana datasource provisioning file
  (`grafana/provisioning/datasources/cortex.yml`) was recreated, and the stack
  was brought up reusing the surviving `monitoring_{prometheus,grafana,loki}_data`
  volumes. Verified: grafana 200 (direct + via Caddy `/grafana/`), prometheus
  healthy, loki ready, tailscale serve `:3000` intact. Backup of the reduced
  compose: `docker-compose.yml.pre-grafana-restore-<ts>`. Phase 9 should
  re-confirm all three are still up.

## Execution Steps

1. Pre-flight (local): `bash -n` + `shellcheck scripts/rebuild/*.sh`,
   `scripts/rebuild/validate.sh --local`.
2. Backup restore dry-run against the verified backup.
3. Live audit (prod SSH): protected services, project instances, AgentGateway
   health/allowlist, monitoring stack, dashboard `/en/login` 200, Caddy routes.
4. Cross-check live services against the dashboard services catalog + manifests.
5. Resolve any gap minimally, re-verify, then mark Phase 9 complete in PLAN.md.

## After Phase 9

- Commit + push (`main`): `feat(rebuild): phase 9 - final validation`.
- The rebuild is complete; no further phase handoff is needed.

## Key Files

- `PLAN.md`
- `scripts/rebuild/validate.sh`, `scripts/rebuild/restore.sh`
- `stacks/cortex-agentgateway/`
- `manifests/rebuild/runtime-protected.tsv`
- `/etc/caddy/Caddyfile` (host)
