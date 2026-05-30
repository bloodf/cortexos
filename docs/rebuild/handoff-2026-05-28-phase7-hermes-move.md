# CortexOS Rebuild Handoff — Phase 7: Project Hermes Move

> **Operator session notes — historical record, not install instructions.**

Generated: 2026-05-28
Workspace: `/Users/heitor/Developer/github.com/bloodf/cortexos`
Supersedes: `handoff-2026-05-28-incus-base-image.md` (now stale — base image + project instances are done).

## How To Use This Handoff

Start a **fresh session** (no compressed context) and paste:

> Continue the CortexOS rebuild. Read `docs/rebuild/handoff-2026-05-28-phase7-hermes-move.md` and `PLAN.md`, then execute Phase 7 (project Hermes move).

The canonical plan is `PLAN.md`; update it with evidence after the phase. After Phase 7
completes, write the next handoff (`handoff-2026-05-28-phase8-retired-infra-removal.md`) and
start another fresh session. **One phase per session, fresh context each time.**

## Repo State (verified 2026-05-28)

- `main` now **is** the rebuild. Force-pushed; HEAD = `df7bcb4`
  (`feat(rebuild): commit phases 1-6 implementation`). `origin/main` == local.
- The previous old-architecture main (67 commits, May 21–27: mail-guardian, hermes-mcp
  runtime, isolated-dev-env, extended paperclip) is preserved at remote branch
  **`pre-rebuild-main-20260528`** — recoverable, not merged. Decision: rebuild is canonical;
  old work was intentionally superseded (paperclip/nats/agent-factory are retired).
- Rebuild was authored from the May-19 base (`790e70d`) and is already **applied live** to the
  prod VPS through Phase 6, so prod reality matches the rebuild, not the old branch.

## Status (from PLAN.md)

- Phases 0–6: **complete and validated live.**
  - Base image: `cortexos-base/ubuntu-26.04-20260528` + `cortexos-base/latest` (fp `056afd491f33`).
  - Project instances RUNNING from `cortexos-base/latest`:
    - `mementry` — <instance-ip>, commit `28d4ba3`
    - `celebrar-me` — <instance-ip>, commit `1f0ab27`
    - `3guns` — <instance-ip>, commit `5c7a234`
- **Phase 7 (project-hermes-move): pending — this is the next step.**
- Phase 8 (retired-infra-removal): pending.
- Phase 9 (final-validation): pending.

## Critical Safety Constraints

- **Never touch protected Hermes identities: `CIEUCPB`, `Netbook`, `Cortex`.** Phase 7 only
  moves the three *project* profiles (`mementry`, `celebrar`, `3guns`).
- Do not revert unrelated dirty repo changes.
- Do not mark the phase complete without fresh evidence.
- Backup dir for all apply runs: `/mnt/hdd/cortexos-backups/20260528T042259Z`.

## Prod Access

- Host: `cortexos@cortexos.<your-tailnet>.ts.net`.
- Read/write SSH was approved for the rebuild. The Claude Code auto-classifier may **re-block
  prod SSH at the start of each new session** — if it does, ask the user to approve prod SSH
  for the session (or have the user run the command with `! <cmd>`).

## Phase 7 Goal

Move the three project Hermes profiles from the host into their Incus instances, validate they
run inside the instances, then remove the host copies from runtime and backup scope.

## What The Phase Does (scripts/rebuild/apply.sh:729 `project-hermes-move`)

Reads `manifests/rebuild/projects.tsv`. Per project (slug/instance/hermes_profile):

1. Asserts the instance is RUNNING.
2. Adds Incus proxy devices so the instance can reach host services on loopback:
   `9router` → `127.0.0.1:11434`, `honcho` → `127.0.0.1:18690` (bind=instance).
3. Pushes `/opt/cortexos/scripts/hermes-profile-api.mjs`, the host profile dir
   `/opt/cortexos/hermes/profiles/<profile>`, and the env file
   `/opt/cortexos/.secrets/hermes/<profile>.env` into the instance; fixes ownership
   (`cortexos:cortexos`) and `chmod 600` on the env.
4. Installs `hermes-profile@<profile>.service` in the instance, `daemon-reload`, enable, start.
5. Waits up to 60s for the unit to become `active`, then probes the Hermes API health endpoint
   (`HERMES_API_PORT` from the env file).
6. Only after **all** projects validate, removes host project profiles + env files
   (`mementry`→`mementry`, `celebrar-me`→`celebrar`, `3guns`→`3guns`).

Supports `--dry-run` (prints `+ bash -lc ...`) and `--execute`.

## Execution Steps

1. Pre-flight (local, no host):
   ```bash
   bash -n scripts/rebuild/apply.sh
   shellcheck scripts/rebuild/apply.sh
   bash scripts/rebuild/validate.sh --local
   ```
2. Confirm host preconditions (prod SSH):
   ```bash
   ssh -o BatchMode=yes -o ConnectTimeout=12 cortexos@cortexos.<your-tailnet>.ts.net '
     sudo -n incus list --format csv -c ns
     ls -1 /opt/cortexos/hermes/profiles
     ls -1 /opt/cortexos/.secrets/hermes
     ls -l /opt/cortexos/scripts/hermes-profile-api.mjs
   '
   ```
   Expect: mementry/celebrar-me/3guns RUNNING; host profiles `mementry`,`celebrar`,`3guns`
   present (plus protected `cieucpb`,`netbook`,`cortex` which must NOT be moved/removed);
   matching env files; `hermes-profile-api.mjs` exists on host.
3. Dry-run:
   ```bash
   scripts/rebuild/apply.sh --phase project-hermes-move --dry-run \
     --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z
   ```
   Read the printed command plan; confirm it only targets the three project profiles.
4. Execute:
   ```bash
   scripts/rebuild/apply.sh --phase project-hermes-move --execute \
     --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z
   ```

## Completion Criteria — do not mark complete until all true

- `hermes-profile@<profile>.service` is `active` inside each of mementry / celebrar-me / 3guns.
- Hermes API health probe inside each instance responded.
- Host project profile dirs + env files removed (`mementry`,`celebrar`,`3guns`).
- Protected host profiles `cieucpb`,`netbook`,`cortex` still present and their services active:
  ```bash
  ssh -o BatchMode=yes -o ConnectTimeout=12 cortexos@cortexos.<your-tailnet>.ts.net '
    sudo -n systemctl is-active \
      hermes-profile@cieucpb.service hermes-profile@netbook.service \
      hermes-gateway@cieucpb.service hermes-gateway@netbook.service \
      hermes-gateway-cortex.service hermes-dashboard.service \
      hermes-dashboard-proxy.service 9router.service honcho-mcp.service \
      ollama.service ollama-honcho-embeddings-proxy.service
  '
  ```
- `PLAN.md` Phase 7 updated to `complete` with the above evidence; "Next Actions" advanced.

## After Phase 7

- Commit + push (`main`): `feat(rebuild): phase 7 - move project Hermes profiles into instances`.
- Write `docs/rebuild/handoff-2026-05-28-phase8-retired-infra-removal.md` (Phase 8 targets:
  hard-remove Paperclip, NATS, OpenViking, LEANN, OpenClaw, Agent Factory, Cortex Consumer,
  Cortex Graph, Floci, Langfuse runtime — apply phase name `retired-runtime` already exists and
  was run once; Phase 8 is the final residue sweep + verification gate).
- Start a fresh session for Phase 8.

## Key Files

- `PLAN.md`
- `scripts/rebuild/apply.sh` (Phase 7 handler at line 729)
- `manifests/rebuild/projects.tsv`
- `/opt/cortexos/scripts/hermes-profile-api.mjs` (on host)
