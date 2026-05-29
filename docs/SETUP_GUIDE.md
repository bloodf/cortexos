# Setup Guide

Use the rebuild scripts:

```bash
scripts/rebuild/inventory.sh --output <dir>
scripts/rebuild/validate.sh --local
scripts/rebuild/backup.sh --dry-run
scripts/rebuild/restore.sh --verify-remote <backup-dir>
```

Only run apply phases after the backup/restore gate in `PLAN.md` is green.

## Incus base images (two-image model)

The `incus-base-image` phase publishes one of two sibling Incus images. Both share the
exact same base provisioning (`stacks/cortex-incus/base-image-provision.sh`: Hermes, AI
CLIs, tmux + plugins, oh-my-zsh, Tailscale, dev tooling). The variant is selected with
the `INCUS_BASE_VARIANT` environment variable:

| Image | `INCUS_BASE_VARIANT` | Contents | Aliases |
| --- | --- | --- | --- |
| `cortexos-base` | _(unset, default)_ | Lean dev/agent base | `cortexos-base/latest`, `cortexos-base/ubuntu-26.04-<date>` |
| `cortexos-gastown-base` | `gastown` | base **+** gastown orchestration (Go, beads, Dolt, `gt`) | `cortexos-gastown-base/latest`, `cortexos-gastown-base/ubuntu-26.04-<date>` |

The gastown variant runs `stacks/cortex-incus/gastown-provision.sh` after the base
provision inside the same builder, so the published image is a strict superset of
`cortexos-base`. Pinned versions live at the top of `gastown-provision.sh`
(`GO_VERSION`, `DOLT_VERSION`); re-verify them against upstream periodically — they drift.
The gastown Dolt data dir is `/gt/.dolt-data`; the `gt` binary is installed to
`/usr/local/bin/gt`.

Build the lean base image (default):

```bash
scripts/rebuild/apply.sh --phase incus-base-image --dry-run  --backup-dir DIR
scripts/rebuild/apply.sh --phase incus-base-image --execute  --backup-dir DIR
```

Build the gastown image:

```bash
INCUS_BASE_VARIANT=gastown scripts/rebuild/apply.sh --phase incus-base-image --dry-run  --backup-dir DIR
INCUS_BASE_VARIANT=gastown scripts/rebuild/apply.sh --phase incus-base-image --execute  --backup-dir DIR
```

Replace `DIR` with a verified backup directory under `/mnt/hdd/cortexos-backups`.
