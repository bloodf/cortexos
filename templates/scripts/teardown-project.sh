#!/usr/bin/env bash
# teardown-project.sh
# Teardown a project's agents, VPS bindings, cron jobs, sqlite rows, and VPS repo.
# Backs up .agents/ before destruction. Idempotent.

set -euo pipefail

PROJECT=""
BACKUP_DIR=""
VPS_HOST=""
REPO_PATH=""
DRY_RUN=0

log()  { printf '[teardown] %s\n' "$*" >&2; }
warn() { printf '[teardown][WARN] %s\n' "$*" >&2; }
die()  { printf '[teardown][ERR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat >&2 <<'EOF'
Usage: teardown-project.sh --project <name> --backup-dir <path> [opts]

Required:
  --project <name>       project name prefix (agents matched as <name>-*)
  --backup-dir <path>    local dir for tarball backups

Optional:
  --repo-path <path>     local repo path (for tarball src; default $PWD)
  --vps-host <ssh>       e.g. cortex; if set, performs remote teardown
  --dry-run              print actions, no execution
  -h|--help
EOF
}

run() {
  if [[ "$DRY_RUN" == 1 ]]; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    --vps-host) VPS_HOST="$2"; shift 2 ;;
    --repo-path) REPO_PATH="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown arg: $1" ;;
  esac
done

[[ -n "$PROJECT" ]]    || { usage; die "--project required"; }
[[ -n "$BACKUP_DIR" ]] || { usage; die "--backup-dir required"; }
[[ -n "$REPO_PATH" ]]  || REPO_PATH="$PWD"

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d-%H%M%S)"

# ---------- 1. tarball .agents ----------
if [[ -d "$REPO_PATH/.agents" ]]; then
  tarball="$BACKUP_DIR/${PROJECT}-agents-${TS}.tgz"
  log "tarball .agents -> $tarball"
  run "tar -czf \"$tarball\" -C \"$REPO_PATH\" .agents"
else
  warn "$REPO_PATH/.agents missing, skipping tarball"
fi

# ---------- 2-5. VPS teardown ----------
if [[ -n "$VPS_HOST" ]]; then
  log "VPS teardown on $VPS_HOST"

  # 2a. backup openclaw.json
  run "ssh \"$VPS_HOST\" 'cp -a ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak-${TS} 2>/dev/null || true'"

  # 2b. list + delete agents matching <project>-*
  if [[ "$DRY_RUN" == 1 ]]; then
    echo "[dry-run] ssh $VPS_HOST 'openclaw agents list | jq -r \".[] | select(.id | startswith(\\\"${PROJECT}-\\\")) | .id\"' | while read id; do openclaw agents delete \"\$id\"; done"
  else
    ssh "$VPS_HOST" "set -e
      if command -v openclaw >/dev/null 2>&1; then
        ids=\$(openclaw agents list 2>/dev/null | jq -r '.[]? | select(.id|tostring|startswith(\"${PROJECT}-\")) | .id' 2>/dev/null || true)
        if [ -n \"\$ids\" ]; then
          echo \"\$ids\" | while read id; do
            [ -n \"\$id\" ] && openclaw agents delete \"\$id\" || true
          done
        else
          echo '[teardown] no matching agents'
        fi
      else
        echo '[teardown] openclaw not found on VPS' >&2
      fi"
  fi

  # 3. remove project bindings + cron jobs
  run "ssh \"$VPS_HOST\" 'crontab -l 2>/dev/null | grep -v \"${PROJECT}-\" | crontab - || true'"
  run "ssh \"$VPS_HOST\" 'rm -f ~/.openclaw/bindings/${PROJECT}-*.json 2>/dev/null || true'"

  # 4. sqlite purge
  for db in ~/.openclaw/registry.db ~/.openclaw/runs.db ~/.openclaw/memory.db; do
    run "ssh \"$VPS_HOST\" 'for d in ${db}; do [ -f \"\$d\" ] && sqlite3 \"\$d\" \"DELETE FROM agents WHERE agent_id LIKE '\\''${PROJECT}-%'\\'';\" 2>/dev/null || true; done'"
  done
  # generic purge across known tables
  run "ssh \"$VPS_HOST\" 'for d in ~/.openclaw/*.db; do [ -f \"\$d\" ] || continue;
    for t in agents runs memory bindings; do
      sqlite3 \"\$d\" \"DELETE FROM \$t WHERE agent_id LIKE '\\''${PROJECT}-%'\\'';\" 2>/dev/null || true;
    done; done'"

  # 5. remove VPS repo
  run "ssh \"$VPS_HOST\" 'rm -rf ${CORTEX_WORKSPACE_ROOT:-/home/${CORTEX_USER}/development}/${PROJECT}'"
else
  warn "--vps-host not provided; skipped VPS teardown"
fi

# ---------- summary ----------
echo
echo "=== teardown-project summary ==="
echo "project:    $PROJECT"
echo "backup_dir: $BACKUP_DIR"
echo "vps_host:   ${VPS_HOST:-(none)}"
echo "dry_run:    $DRY_RUN"
echo "tarball:    ${tarball:-(none)}"
