#!/usr/bin/env bash
# regenerate-agents-md.sh
# Re-run template substitution on existing .agents/ dirs. Idempotent.
# Preserves MEMORY.md and HEARTBEAT.md (only writes if missing).
# Rewrites ROLE.md, SOUL.md, STACK.md, PIPELINE.md, and other factory files.

set -euo pipefail

PROJECT=""
REPO_PATH=""
TEMPLATES_DIR=""
THEME=""
EMOJI=""
LANG=""
FRAMEWORK=""
DEPLOYMENT=""
DB=""
INFRA=""
OWNER_NAME="${OWNER_NAME:-}"
OWNER_TG="${OWNER_TG:-}"
MODEL="9router/cx/gpt-5.5"
LANG_DEFAULT="pt-BR"
LANG_TECHNICAL="en"
DRY_RUN=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()  { printf '[regen] %s\n' "$*" >&2; }
warn() { printf '[regen][WARN] %s\n' "$*" >&2; }
die()  { printf '[regen][ERR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat >&2 <<'EOF'
Usage: regenerate-agents-md.sh --project <name> --repo-path <path> [opts]

Required:
  --project <name>
  --repo-path <path>

Optional (used for placeholder substitution):
  --templates-dir <path>
  --theme <s> --emoji <s> --lang <s> --framework <s> --deployment <s>
  --db <s> --infra <s> --owner-name <s> --owner-telegram-chat-id <s> --model <s>
  --dry-run
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --repo-path) REPO_PATH="$2"; shift 2 ;;
    --templates-dir) TEMPLATES_DIR="$2"; shift 2 ;;
    --theme) THEME="$2"; shift 2 ;;
    --emoji) EMOJI="$2"; shift 2 ;;
    --lang) LANG="$2"; shift 2 ;;
    --framework) FRAMEWORK="$2"; shift 2 ;;
    --deployment) DEPLOYMENT="$2"; shift 2 ;;
    --db) DB="$2"; shift 2 ;;
    --infra) INFRA="$2"; shift 2 ;;
    --owner-name) OWNER_NAME="$2"; shift 2 ;;
    --owner-telegram-chat-id) OWNER_TG="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown arg: $1" ;;
  esac
done

[[ -n "$PROJECT" ]]    || { usage; die "--project required"; }
[[ -n "$REPO_PATH" ]]  || { usage; die "--repo-path required"; }
[[ -n "$OWNER_NAME" ]] || die "OWNER_NAME env var or --owner-name required (no hardcoded fallback)"
[[ -n "$OWNER_TG" ]]   || die "OWNER_TG env var or --owner-telegram-chat-id required (no hardcoded fallback)"
[[ -d "$REPO_PATH/.agents" ]] || die "no .agents/ dir at $REPO_PATH"

if [[ -z "$TEMPLATES_DIR" ]]; then
  if [[ -d "$SCRIPT_DIR/../agent-factory" ]]; then
    TEMPLATES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  else
    die "cannot resolve --templates-dir"
  fi
fi

# Preserve these — don't overwrite
PRESERVE=(MEMORY.md HEARTBEAT.md)
# Always regenerate (overwrite)
REGEN=(SOUL.md IDENTITY.md USER.md BOOTSTRAP.md AGENTS.md CI_POLICY.md
       TELEGRAM_APPROVAL.md TOOLS.md ESCALATION.md STACK.md PIPELINE.md ROLE.md)

apply_substitutions() {
  local file="$1" role="$2"
  local agent_name="${PROJECT}-${role}"
  local tmp; tmp="$(mktemp)"
  esc() { printf '%s' "$1" | sed 's/[\/&]/\\&/g'; }

  sed \
    -e "s/{agent_name}/$(esc "$agent_name")/g" \
    -e "s/{agent_emoji}/$(esc "$EMOJI")/g" \
    -e "s/{theme}/$(esc "$THEME")/g" \
    -e "s/{project}/$(esc "$PROJECT")/g" \
    -e "s/{owner_name}/$(esc "$OWNER_NAME")/g" \
    -e "s/{owner_telegram_chat_id}/$(esc "$OWNER_TG")/g" \
    -e "s/{model}/$(esc "$MODEL")/g" \
    -e "s/{language_default}/$(esc "$LANG_DEFAULT")/g" \
    -e "s/{language_technical}/$(esc "$LANG_TECHNICAL")/g" \
    -e "s/{lang}/$(esc "$LANG")/g" \
    -e "s/{framework}/$(esc "$FRAMEWORK")/g" \
    -e "s/{deployment}/$(esc "$DEPLOYMENT")/g" \
    -e "s/{db}/$(esc "$DB")/g" \
    -e "s/{infra}/$(esc "$INFRA")/g" \
    -e "s/{role}/$(esc "$role")/g" \
    "$file" > "$tmp"
  mv "$tmp" "$file"
}

resolve_role_file() {
  local role="$1"
  local cand="$TEMPLATES_DIR/agent-roles/${role}.md"
  if [[ -f "$cand" ]]; then echo "$cand"; return; fi
  case "$role" in
    ENG-BACKEND|ENG-FRONTEND|ENG-MOBILE) echo "$TEMPLATES_DIR/agent-roles/ENGINEER.md"; return ;;
  esac
  echo "$TEMPLATES_DIR/agent-roles/ENGINEER.md"
}

FILES_REGEN=0
FILES_PRESERVED=0

for role_dir in "$REPO_PATH"/.agents/*/; do
  [[ -d "$role_dir" ]] || continue
  role_lower="$(basename "$role_dir")"
  role_upper="$(echo "$role_lower" | tr '[:lower:]' '[:upper:]')"
  log "regen role: $role_upper"

  # preserve
  for f in "${PRESERVE[@]}"; do
    if [[ ! -f "$role_dir/$f" ]]; then
      src="$TEMPLATES_DIR/agent-factory/$f"
      [[ -f "$src" ]] || continue
      if [[ "$DRY_RUN" == 1 ]]; then
        log "[dry-run] restore missing $role_dir$f"
      else
        cp "$src" "$role_dir/$f"
        apply_substitutions "$role_dir/$f" "$role_upper"
        FILES_REGEN=$((FILES_REGEN+1))
      fi
    else
      FILES_PRESERVED=$((FILES_PRESERVED+1))
    fi
  done

  # regen
  for f in "${REGEN[@]}"; do
    if [[ "$f" == "ROLE.md" ]]; then
      src="$(resolve_role_file "$role_upper")"
    else
      src="$TEMPLATES_DIR/agent-factory/$f"
    fi
    [[ -f "$src" ]] || { warn "missing template $src"; continue; }
    if [[ "$DRY_RUN" == 1 ]]; then
      log "[dry-run] regen $role_dir$f"
    else
      cp "$src" "$role_dir/$f"
      apply_substitutions "$role_dir/$f" "$role_upper"
      FILES_REGEN=$((FILES_REGEN+1))
    fi
  done
done

echo
echo "=== regenerate-agents-md summary ==="
echo "project:        $PROJECT"
echo "repo:           $REPO_PATH"
echo "files regen:    $FILES_REGEN"
echo "files preserved:$FILES_PRESERVED"
echo "dry_run:        $DRY_RUN"
