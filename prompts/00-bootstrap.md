# 00 - CortexOS Rebuild Bootstrap

This is the entrypoint for the CortexOS rebuild. The canonical source of truth
is `PLAN.md`; every phase must update it with status, evidence, risks, and next
actions before moving forward.

## Ground Rules

- Do not run destructive cleanup until the backup/export flow has produced
  local artifacts under `/mnt/hdd/cortexos-backups` and restore listing passes.
- The host remains the control/data plane.
- New project development and project agents move into Incus instances.
- Secrets stay in host-owned env files. The repo tracks only manifests and
  validation rules.
- Protected Hermes identities `cieucpb`, `netbook`, and `cortex` must be
  preserved and restored on the host.
- Project Hermes profiles `mementry`, `celebrar`, and `3guns` move into their
  project instances only after those instances validate.
- Retired systems are removed after backup according to
  `manifests/rebuild/retired-systems.txt`.

## Required First Commands

Run from the repository root:

```bash
scripts/rebuild/validate.sh --local
scripts/rebuild/plan.sh
scripts/rebuild/inventory.sh --output /tmp/cortexos-inventory-remote
scripts/rebuild/backup.sh --dry-run
```

`scripts/rebuild/apply.sh` is intentionally blocked until the backup/restore
gate has passed.

## Execution Order

1. Baseline inventory: systemd, Docker, ports, packages, repos, secret file
   names, databases, Hermes profiles, Honcho state, Caddy, Tailscale, cron,
   and timers.
2. Repo source of truth: manifests and scripts under `manifests/rebuild/` and
   `scripts/rebuild/`.
3. Backup and restore gate under `/mnt/hdd/cortexos-backups`.
4. Cortex-managed host rebuild.
5. Protected Hermes, Honcho, 9Router, Ollama restoration.
6. Incus foundation with Ubuntu 26.04 unprivileged containers and file-backed
   ZFS under `/mnt/hdd`.
7. Project instances for `mementry`, `celebrar-me`, and `3guns`.
8. Project Hermes migration into instances.
9. Retired-infra removal.
10. Full validation.

## Validation Contract

Each phase must prove its own gate before the next phase starts. Evidence goes
into `PLAN.md` and durable details go into `docs/rebuild/` when useful.

Current durable inventory summary:

- `docs/rebuild/current-host-inventory.md`

Machine-readable rebuild decisions:

- `manifests/rebuild/service-placement.tsv`
- `manifests/rebuild/projects.tsv`
- `manifests/rebuild/protected-hermes.txt`
- `manifests/rebuild/retired-systems.txt`
- `manifests/rebuild/backup-scope.tsv`
- `manifests/rebuild/secrets.manifest.tsv`
- `manifests/rebuild/incus-base-image.tsv`
- `manifests/rebuild/tmux-plugins.txt`
- `manifests/rebuild/tmux-session-model.tsv`
- `manifests/rebuild/dashboard-helper-audit.sql`
- `manifests/rebuild/dashboard-helper-log-format.json`
- `manifests/rebuild/mcp-global-allowlist.txt`
