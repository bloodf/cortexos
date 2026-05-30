# Server-Side Dashboard Dev & Rebuild Loop

Operator runbook for working on the CortexOS host (`/opt/cortexos`) directly,
rather than driving the rebuild from a laptop. Covers the dashboard
pull → build → restart loop and the gastown Incus base-image build.

> The dashboard runs as a **native systemd service** (`cortex-dashboard.service`,
> root, port `3080`) — not Docker. Auth is Linux **PAM** (no DB-seeded admins).
> Secrets stay in `/opt/cortexos/.secrets` via SOPS+age; never commit them.

## Prerequisites

- `/opt/cortexos` is a real git checkout of `github.com/bloodf/cortexos` `main`.
  Runtime files (`.secrets/`, built `server.js`, `node_modules/`) are gitignored,
  so `git reset --hard origin/main` does not touch them. To (re)establish the
  checkout on a materialized tree:

  ```bash
  cd /opt/cortexos
  sudo git init -q
  sudo git remote add origin https://github.com/bloodf/cortexos.git
  sudo git fetch origin main
  # Preview drift first (mixed reset leaves the working tree untouched):
  sudo git reset origin/main && git -C /opt/cortexos status --short
  # Then reconcile to the canonical commit:
  sudo git reset --hard origin/main
  ```

## Dashboard: pull → build → restart loop

```bash
cd /opt/cortexos
sudo git pull origin main

# Native build: per-package npm install (skipped on re-runs if esbuild +
# authenticate-pam are already built — set FORCE_INSTALL=1 to force), next
# build, esbuild server.ts -> server.js, Turbopack external-module shims.
sudo /opt/cortexos/scripts/ops/cortex-dashboard-build.sh

sudo systemctl restart cortex-dashboard.service && sleep 9
```

### Verify (expected values)

```bash
systemctl is-active cortex-dashboard.service                              # active
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/en/login   # 200
sudo journalctl -u cortex-dashboard.service --since '60 sec ago' \
  --no-pager | grep -c '⨯\|TypeError'                                     # 0
```

The build is idempotent. The `next start … output: standalone` and
`url.parse()` deprecation lines in the journal are benign.

## gastown Incus base image build

Builds `cortexos-gastown-base` — the lean `cortexos-base` image plus the gastown
multi-agent CLI (Go + Dolt + beads + `gt`). Tooling lives under
`scripts/rebuild/` and `stacks/cortex-incus/`. Takes ~20 min; run it in tmux.

> **The rebuild scripts are controller scripts.** They dispatch every real
> action over `ssh "$CORTEX_HOST" … bash -s` and require passwordless `sudo` in
> that session. To run them *on the host against itself*, point `CORTEX_HOST` at
> a loopback SSH target. `BACKUP_ROOT` defaults to `/mnt/hdd/cortexos-backups`.

```bash
tmux new -s release
cd /opt/cortexos
export CORTEX_HOST=cortexos@127.0.0.1 BACKUP_ROOT=/mnt/hdd/cortexos-backups
BID="gastown-prep-$(date -u +%Y%m%dT%H%M%SZ)"

# 1. Fresh, verified backup. apply.sh requires archives/{hermes,secrets}.tgz +
#    SHA256SUMS, so an older backup lacking secrets.tgz will not qualify.
./scripts/rebuild/backup.sh --execute --backup-id "$BID"
./scripts/rebuild/restore.sh --verify-remote "$BACKUP_ROOT/$BID"   # "verification passed"

# 2. Dry-run validates the whole pipeline without mutating Incus.
INCUS_BASE_VARIANT=gastown ./scripts/rebuild/apply.sh \
  --phase incus-base-image --dry-run --backup-dir "$BACKUP_ROOT/$BID"

# 3. Execute. Launches a builder, runs base-image-provision.sh +
#    gastown-provision.sh, publishes cortexos-gastown-base/{latest,ubuntu-26.04-<date>},
#    then self-smoke-tests a throwaway instance (gt, dolt, go, hermes).
INCUS_BASE_VARIANT=gastown ./scripts/rebuild/apply.sh \
  --phase incus-base-image --execute --backup-dir "$BACKUP_ROOT/$BID"

incus image list | grep gastown    # cortexos-gastown-base/{latest,ubuntu-26.04-<date>}
```

Prerequisites checked by the phase: incus storage `cortex-zfs`, network
`incusbr0`, and the `images:ubuntu/26.04` remote. The default (lean) image is
built by omitting `INCUS_BASE_VARIANT`.

> The backup writes a **local-only** secrets archive (mode `0600` under
> `/mnt/hdd`). It is never committed — consistent with the SOPS+age secret path.

## Notes

- The historical handoff flags (`backup.sh --out …`, `/var/backups/cortex`) are
  stale; the current interface is `--execute [--backup-id ID]` writing to
  `$BACKUP_ROOT`. Always read the script before running if flags look off.
- Related: [DASHBOARD.md](DASHBOARD.md),
  [SETUP_GUIDE.md](SETUP_GUIDE.md),
  [TMUX.md](TMUX.md),
  [rebuild/handoff-2026-05-28-incus-base-image.md](rebuild/handoff-2026-05-28-incus-base-image.md).
