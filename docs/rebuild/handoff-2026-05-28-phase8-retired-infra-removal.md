# CortexOS Rebuild Handoff — Phase 8: Retired Infra Removal

Generated: 2026-05-28
Workspace: `/Users/heitor/Developer/github.com/bloodf/cortexos`
Supersedes: `handoff-2026-05-28-phase7-hermes-move.md` (Phase 7 complete).

## How To Use This Handoff

Start a **fresh session** and paste:

> Continue the CortexOS rebuild. Read `docs/rebuild/handoff-2026-05-28-phase8-retired-infra-removal.md` and `PLAN.md`, then execute Phase 8 (retired infra removal).

Canonical plan is `PLAN.md`; update it with evidence after the phase. One phase
per session, fresh context each time. After Phase 8, write
`handoff-2026-05-28-phase9-final-validation.md`.

## Repo State (verified 2026-05-28)

- `main` is the rebuild. Phase 7 verified + committed.
- Old-architecture main preserved at remote branch
  `pre-rebuild-main-20260528` (recoverable, not merged).

## Status (from PLAN.md)

- Phases 0–7: **complete and validated live.**
  - Base image `cortexos-base/latest` (fp `056afd491f33`).
  - Project instances RUNNING with project Hermes profiles inside:
    - `mementry` — 10.222.222.175, profile `mementry`, hermes port 18697, health 200
    - `celebrar-me` — 10.222.222.86, profile `celebrar`, hermes port 18696, health 200
    - `3guns` — 10.222.222.23, profile `3guns`, hermes port 18695, health 200
  - Host project Hermes profiles + env files removed; protected
    `cieucpb`/`netbook`/`cortex` profiles + 11 protected host services active.
- **Phase 8 (retired-infra-removal): pending — this is the next step.**
- Phase 9 (final-validation): pending.

## Phase 7 Outcome Note (read before Phase 8)

Phase 7 was already executed live by a prior session (host project profiles
removed at 17:57 on 2026-05-28). This session verified the end-state directly
rather than re-running (host source profiles were already gone, so a re-run
would WARN-skip all three and error). All Phase 7 completion criteria passed.
**Lesson for Phase 8: verify live host state first; a prior session may have
already applied a phase. Do not assume the host matches the last handoff's
"pending" status — confirm before acting.**

## Critical Safety Constraints

- **Never touch protected Hermes identities `cieucpb`, `netbook`, `cortex`** or
  their services / profile dirs.
- Never touch the three project instances or their in-instance Hermes profiles.
- No destructive action without the verified backup gate
  (`/mnt/hdd/cortexos-backups/20260528T042259Z`).
- Do not mark the phase complete without fresh evidence.

## Prod Access

- Host: `cortexos@cortexos.tailfd052e.ts.net`.
- The Claude Code auto-classifier may re-block prod SSH at session start. Ask the
  user to approve prod SSH for the session if blocked.

## Phase 8 Goal

Hard-remove retired systems and sweep stale repo/runtime residue. Targets:

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

Note: the `retired-runtime` apply phase already ran once during Phase 3 and
cleaned the bulk of these. Phase 8 is the **final residue sweep + verification
gate** — find anything that survived (units, containers, ports, Caddy routes,
dashboard entries, prompts, scripts, schemas, migrations, packages, docs) and
remove it, then prove none remain active.

## Execution Steps

1. Pre-flight (local, no host):
   ```bash
   bash -n scripts/rebuild/apply.sh
   shellcheck scripts/rebuild/apply.sh
   bash scripts/rebuild/validate.sh --local
   ```
2. Audit live host for retired residue (prod SSH) — systemd units, docker
   containers, listening ports, Caddy routes, files under `/opt/cortexos`,
   secrets, stack dirs, `/usr/local/bin` shims. Cross-check against
   `manifests/rebuild/runtime-retired.tsv` and `manifests/rebuild/retired-systems.txt`.
3. Re-run the retired-runtime apply to catch residue (dry-run then execute):
   ```bash
   scripts/rebuild/apply.sh --phase retired-runtime --dry-run \
     --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z
   scripts/rebuild/apply.sh --phase retired-runtime --execute \
     --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z
   ```
4. Manually remove any residue the manifest does not cover; add new entries to
   `runtime-retired.tsv` for anything found (as was done for the leftover
   Paperclip socket/timer in Phase 3).

## Completion Criteria — do not mark complete until all true

- No retired systemd units active or enabled.
- No retired Docker containers running.
- No retired listening ports.
- No retired Caddy routes, dashboard catalog entries, prompts, scripts, schemas,
  migrations, packages, or docs remain.
- Protected Hermes + project instances unaffected (re-run the Phase 7 protected
  check).
- `PLAN.md` Phase 8 updated to `complete` with evidence; Next Actions advanced.

## After Phase 8

- Commit + push (`main`): `feat(rebuild): phase 8 - retired infra removal`.
- Write `docs/rebuild/handoff-2026-05-28-phase9-final-validation.md`.
- Start a fresh session for Phase 9.

## Key Files

- `PLAN.md`
- `scripts/rebuild/apply.sh` (retired-runtime handler)
- `manifests/rebuild/runtime-retired.tsv`
- `manifests/rebuild/retired-systems.txt`
- `manifests/rebuild/runtime-protected.tsv`
