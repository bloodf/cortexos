# CortexOS Rebuild Dependency Graph

The old spoke dependency graph is retired. Use this phase graph with
`PLAN.md`, `manifests/rebuild/`, and `scripts/rebuild/`.

```yaml
phases:
  00-baseline-inventory:
    deps: []
    command: scripts/rebuild/inventory.sh --output <dir>
    destructive: false

  01-repo-source-of-truth:
    deps: [00-baseline-inventory]
    command: scripts/rebuild/validate.sh --local
    destructive: false

  02-backup-restore-gate:
    deps: [00-baseline-inventory, 01-repo-source-of-truth]
    command: scripts/rebuild/backup.sh --dry-run
    destructive: false

  03-host-rebuild:
    deps: [02-backup-restore-gate]
    command: scripts/rebuild/apply.sh
    destructive: true

  04-hermes-ai-core:
    deps: [03-host-rebuild]
    command: validate protected Hermes, Honcho, 9Router, Ollama
    destructive: false

  05-incus-foundation:
    deps: [04-hermes-ai-core]
    command: install Incus, create file-backed ZFS, build base image
    destructive: false

  06-project-instances:
    deps: [05-incus-foundation]
    command: create mementry, celebrar-me, 3guns from clean main
    destructive: false

  07-project-hermes-move:
    deps: [06-project-instances]
    command: move project Hermes profiles into instances
    destructive: true

  08-retired-infra-removal:
    deps: [07-project-hermes-move]
    command: remove runtime systems listed in manifests/rebuild/retired-systems.txt
    destructive: true

  09-final-validation:
    deps: [08-retired-infra-removal]
    command: scripts/rebuild/validate.sh --local plus live host checks
    destructive: false
```

## Notes

- `03-host-rebuild`, `07-project-hermes-move`, and
  `08-retired-infra-removal` stay blocked until the backup/restore gate passes.
- Docker is allowed only as a transition runtime with explicit sunset criteria.
- Shared Incus bridge trust is accepted, but per-project databases, users,
 buckets, and credentials are still required.
- Tool-install spokes run after `03-host-rebuild` in numeric order:
  `10–28` (hardening/monitoring/db-exporters), `31` (9router), `32` (honcho),
  `42` (hermes-honcho), `50` (obot), `56–59` (db admin UIs),
  `70` (dashboard), `81` (projects), `90` (cortex-ops), `99` (final validation).
- Optional spokes: `14a` (home-assistant), `14b` (jellyfin), `16a` (mysql),
  `27` (dockhand), `56` (pgadmin), `58` (mongo-express), `59` (phpmyadmin),
  `82` (mail-guardian).
