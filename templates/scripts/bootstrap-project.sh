#!/usr/bin/env bash
# bootstrap-project.sh
# Bootstrap a project repo with .agents/<role>/ scaffolding from templates/.
# Idempotent: never overwrites existing files (writes .new + warns).

set -euo pipefail

# ---------- defaults ----------
PROJECT=""
REPO_PATH=""
ROLES=""
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
TEMPLATES_DIR=""
DRY_RUN=0
INCLUDE_GH_WORKFLOWS=0  # opt-in under CortexOS doctrine (husky-as-CI is canonical)
# LANG_DEFAULT=pt-BR rationale: owner is Brazilian-Portuguese-first.
# Agent prompts, user-facing strings, commit/PR/issue summaries default to pt-BR.
# Code identifiers, log messages, and external API contracts stay in en (LANG_TECHNICAL).
# Override per project with --lang or environment vars when targeting a different audience.
LANG_DEFAULT="pt-BR"
LANG_TECHNICAL="en"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---------- helpers ----------
log()  { printf '[bootstrap] %s\n' "$*" >&2; }
warn() { printf '[bootstrap][WARN] %s\n' "$*" >&2; }
die()  { printf '[bootstrap][ERR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat >&2 <<'EOF'
Usage: bootstrap-project.sh --project <name> --repo-path <path> --roles <CSV> [opts]

Required:
  --project <name>           e.g. example-project
  --repo-path <path>         path to project repo (must be git repo)
  --roles <CSV>              e.g. CEO,CTO,PM,PO,QA,UXUI,ENG-BACKEND,ENGINEER

Optional:
  --theme <s>                project theme
  --emoji <s>                project emoji(s)
  --lang <s>                 language (e.g. typescript, python)
  --framework <s>            framework (e.g. next, fastapi)
  --deployment <s>           deployment target
  --db <s>                   database
  --infra <s>                infra
  --owner-name <s>           default Heitor
  --owner-telegram-chat-id   default <OWNER_CHAT_ID>
  --model <s>                default 9router/cx/gpt-5.5
  --templates-dir <path>     default: ../<this-script>/.. (auto-resolved)
  --dry-run                  print actions, no writes
  -h|--help                  this help
EOF
}

# ---------- arg parse ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --repo-path) REPO_PATH="$2"; shift 2 ;;
    --roles) ROLES="$2"; shift 2 ;;
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
    --templates-dir) TEMPLATES_DIR="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --include-gh-workflows) INCLUDE_GH_WORKFLOWS=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown arg: $1" ;;
  esac
done

# ---------- validate ----------
[[ -n "$PROJECT" ]]    || { usage; die "--project required"; }
[[ -n "$REPO_PATH" ]]  || { usage; die "--repo-path required"; }
[[ -n "$ROLES" ]]      || { usage; die "--roles required"; }
[[ -n "$OWNER_NAME" ]] || die "OWNER_NAME env var required (no hardcoded fallback)"
[[ -n "$OWNER_TG" ]]   || die "OWNER_TG env var required (no hardcoded fallback)"

[[ -d "$REPO_PATH" ]]      || die "repo path does not exist: $REPO_PATH"
[[ -d "$REPO_PATH/.git" ]] || die "not a git repo: $REPO_PATH"

if [[ -z "$TEMPLATES_DIR" ]]; then
  # script lives at templates/scripts/, so templates root is parent
  if [[ -d "$SCRIPT_DIR/../agent-factory" ]]; then
    TEMPLATES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  elif [[ -d "$PWD/templates/agent-factory" ]]; then
    TEMPLATES_DIR="$PWD/templates"
  else
    die "cannot resolve --templates-dir; pass explicitly"
  fi
fi

[[ -d "$TEMPLATES_DIR/agent-factory" ]] || die "missing $TEMPLATES_DIR/agent-factory"
[[ -d "$TEMPLATES_DIR/agent-roles" ]]   || die "missing $TEMPLATES_DIR/agent-roles"

log "project=$PROJECT repo=$REPO_PATH templates=$TEMPLATES_DIR dry_run=$DRY_RUN"

# ---------- factory files to copy per role ----------
# spec (11 canonical files, matches verify-pipeline.sh REQUIRED_FILES):
#   SOUL, IDENTITY, BOOTSTRAP, AGENTS, TOOLS, MEMORY, HEARTBEAT, USER,
#   WORKFLOW, PIPELINE
# (ROLE.md is sourced separately from templates/agent-roles/<ROLE>.md.)
FACTORY_FILES=(
  SOUL.md IDENTITY.md BOOTSTRAP.md AGENTS.md
  TOOLS.md MEMORY.md HEARTBEAT.md USER.md
  WORKFLOW.md PIPELINE.md
)

# ---------- placeholder substitution ----------
# Writes sed -i transcript-safe across darwin & gnu.
sed_inplace() {
  local file="$1"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
  # actually the above is wrong invocation; do simple wrapper
  :
}

# Use temp file rewrite to stay portable.
apply_substitutions() {
  local file="$1"
  local role="$2"
  local agent_name="${PROJECT}-${role}"
  local tmp
  tmp="$(mktemp)"
  # Escape values for sed replacement (only & and / and backslash)
  esc() { printf '%s' "$1" | sed -e 's/[\/&]/\\&/g' -e 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//'; }
  local s_agent s_emoji s_theme s_proj s_owner s_tg s_model s_ld s_lt s_lang s_fw s_dep s_db s_infra s_role
  s_agent=$(esc "$agent_name")
  s_emoji=$(esc "$EMOJI")
  s_theme=$(esc "$THEME")
  s_proj=$(esc "$PROJECT")
  s_owner=$(esc "$OWNER_NAME")
  s_tg=$(esc "$OWNER_TG")
  s_model=$(esc "$MODEL")
  s_ld=$(esc "$LANG_DEFAULT")
  s_lt=$(esc "$LANG_TECHNICAL")
  s_lang=$(esc "$LANG")
  s_fw=$(esc "$FRAMEWORK")
  s_dep=$(esc "$DEPLOYMENT")
  s_db=$(esc "$DB")
  s_infra=$(esc "$INFRA")
  s_role=$(esc "$role")

  sed \
    -e "s/{agent_name}/${s_agent}/g" \
    -e "s/{agent_emoji}/${s_emoji}/g" \
    -e "s/{theme}/${s_theme}/g" \
    -e "s/{project}/${s_proj}/g" \
    -e "s/{owner_name}/${s_owner}/g" \
    -e "s/{owner_telegram_chat_id}/${s_tg}/g" \
    -e "s/{model}/${s_model}/g" \
    -e "s/{language_default}/${s_ld}/g" \
    -e "s/{language_technical}/${s_lt}/g" \
    -e "s/{lang}/${s_lang}/g" \
    -e "s/{framework}/${s_fw}/g" \
    -e "s/{deployment}/${s_dep}/g" \
    -e "s/{db}/${s_db}/g" \
    -e "s/{infra}/${s_infra}/g" \
    -e "s/{role}/${s_role}/g" \
    "$file" > "$tmp"
  mv "$tmp" "$file"
}

# ---------- role -> ROLE.md file resolution ----------
resolve_role_file() {
  local role="$1"
  local candidate="$TEMPLATES_DIR/agent-roles/${role}.md"
  if [[ -f "$candidate" ]]; then
    echo "$candidate"; return 0
  fi
  # Fallback to generic ENGINEER.md only if no specialized role file exists.
  # ENG-BACKEND.md, ENG-FRONTEND.md, ENG-MOBILE.md, ENG-ESP32.md are preferred
  # and will match the candidate path above before reaching this fallback.
  echo "$TEMPLATES_DIR/agent-roles/ENGINEER.md"
}

# ---------- copy helper (idempotent) ----------
copy_idempotent() {
  local src="$1" dst="$2"
  if [[ ! -f "$src" ]]; then warn "missing source: $src (skip)"; return 0; fi
  if [[ -f "$dst" ]]; then
    if [[ "$DRY_RUN" == 1 ]]; then
      warn "[dry-run] would write $dst.new (exists)"
    else
      cp "$src" "${dst}.new"
      warn "exists, wrote ${dst}.new"
    fi
    echo "${dst}.new"
    return 0
  fi
  if [[ "$DRY_RUN" == 1 ]]; then
    log "[dry-run] copy $src -> $dst"
  else
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
  echo "$dst"
}

# ---------- role processing ----------
IFS=',' read -r -a ROLE_ARR <<< "$ROLES"

ROLES_DONE=()
FILES_WRITTEN=0

for raw_role in "${ROLE_ARR[@]}"; do
  role="$(echo "$raw_role" | tr -d '[:space:]')"
  [[ -z "$role" ]] && continue
  role_upper="$(echo "$role" | tr '[:lower:]' '[:upper:]')"
  role_lower="$(echo "$role" | tr '[:upper:]' '[:lower:]')"
  role_dir="$REPO_PATH/.agents/${role_lower}"

  log "role: $role_upper -> $role_dir"

  if [[ "$DRY_RUN" != 1 ]]; then
    mkdir -p "$role_dir/incidents"
    : > "$role_dir/incidents/.gitkeep"
  fi

  # copy factory files
  for f in "${FACTORY_FILES[@]}"; do
    src="$TEMPLATES_DIR/agent-factory/$f"
    dst="$role_dir/$f"
    written="$(copy_idempotent "$src" "$dst")"
    if [[ -n "$written" && "$DRY_RUN" != 1 && -f "$written" ]]; then
      apply_substitutions "$written" "$role_upper"
      FILES_WRITTEN=$((FILES_WRITTEN+1))
    fi
  done

  # ROLE.md
  rf="$(resolve_role_file "$role_upper")"
  dst="$role_dir/ROLE.md"
  written="$(copy_idempotent "$rf" "$dst")"
  if [[ -n "$written" && "$DRY_RUN" != 1 && -f "$written" ]]; then
    apply_substitutions "$written" "$role_upper"
    FILES_WRITTEN=$((FILES_WRITTEN+1))
  fi

  ROLES_DONE+=("$role_upper")
done

# ---------- repo-root AGENTS.md (roster) ----------
roster_path="$REPO_PATH/AGENTS.md"
if [[ -f "$roster_path" ]]; then
  warn "$roster_path exists, leaving untouched"
else
  if [[ "$DRY_RUN" == 1 ]]; then
    log "[dry-run] write $roster_path"
  else
    {
      echo "# ${PROJECT} — Agent Roster"
      echo
      [[ -n "$THEME" ]] && echo "Theme: $THEME"
      [[ -n "$EMOJI" ]] && echo "Emoji: $EMOJI"
      echo
      echo "## Roles"
      echo
      for r in "${ROLES_DONE[@]}"; do
        rl="$(echo "$r" | tr '[:upper:]' '[:lower:]')"
        echo "- **${PROJECT}-${r}** → \`.agents/${rl}/\`"
      done
      echo
      echo "## Owner"
      echo "- $OWNER_NAME (telegram: $OWNER_TG)"
    } > "$roster_path"
    FILES_WRITTEN=$((FILES_WRITTEN+1))
  fi
fi

# ---------- repo-root CLAUDE.md stub ----------
claude_path="$REPO_PATH/CLAUDE.md"
if [[ -f "$claude_path" ]]; then
  warn "$claude_path exists, leaving untouched"
else
  if [[ "$DRY_RUN" == 1 ]]; then
    log "[dry-run] write $claude_path"
  else
    {
      echo "# ${PROJECT}"
      echo
      [[ -n "$THEME" ]] && echo "$THEME"
      echo
      echo "## Agents"
      echo
      echo "See [AGENTS.md](AGENTS.md) for roster. Per-role config in \`.agents/<role>/\`."
      echo
      echo "## Stack"
      echo
      [[ -n "$LANG" ]]       && echo "- Lang: $LANG"
      [[ -n "$FRAMEWORK" ]]  && echo "- Framework: $FRAMEWORK"
      [[ -n "$DB" ]]         && echo "- DB: $DB"
      [[ -n "$INFRA" ]]      && echo "- Infra: $INFRA"
      [[ -n "$DEPLOYMENT" ]] && echo "- Deployment: $DEPLOYMENT"
    } > "$claude_path"
    FILES_WRITTEN=$((FILES_WRITTEN+1))
  fi
fi

# ---------- github workflows ----------
# Factory-created agents require repo workflow/pipeline files so every new agent has same gates.
gh_dir="$REPO_PATH/.github"
wf_dir="$gh_dir/workflows"
if [[ -d "$TEMPLATES_DIR/workflows" ]]; then
  for wf in workflow-pipeline.yml gate-enforcement.yml agent-mention-router.yml ai-review-request.yml; do
    src="$TEMPLATES_DIR/workflows/$wf"
    [[ -f "$src" ]] || { warn "missing workflow $wf"; continue; }
    dst="$wf_dir/$wf"
    if [[ -f "$dst" ]]; then
      warn "$dst exists, skipping"
      continue
    fi
    if [[ "$DRY_RUN" == 1 ]]; then
      log "[dry-run] copy $src -> $dst"
    else
      mkdir -p "$wf_dir"
      cp "$src" "$dst"
      FILES_WRITTEN=$((FILES_WRITTEN+1))
    fi
  done
else
  warn "templates/workflows missing; skip workflow copy"
fi

if [[ -f "$TEMPLATES_DIR/labels.yml" ]]; then
  dst="$gh_dir/labels.yml"
  if [[ -f "$dst" ]]; then
    warn "$dst exists, skipping"
  else
    if [[ "$DRY_RUN" == 1 ]]; then
      log "[dry-run] copy labels.yml"
    else
      mkdir -p "$gh_dir"
      cp "$TEMPLATES_DIR/labels.yml" "$dst"
      FILES_WRITTEN=$((FILES_WRITTEN+1))
    fi
  fi
fi

# ---------- summary ----------
echo
echo "=== bootstrap-project summary ==="
echo "project:        $PROJECT"
echo "repo:           $REPO_PATH"
echo "templates:      $TEMPLATES_DIR"
echo "roles created:  ${ROLES_DONE[*]:-(none)}"
echo "files written:  $FILES_WRITTEN"
echo "dry_run:        $DRY_RUN"
echo "placeholders:   {agent_name} {agent_emoji} {theme} {project} {owner_name}"
echo "                {owner_telegram_chat_id} {model} {language_default} {language_technical}"
echo "                {lang} {framework} {deployment} {db} {infra} {role}"
