#!/usr/bin/env bash
# update-agent-role-gstack.sh
# Idempotently appends the `## Gstack Workflows` section from
# templates/agent-roles/<ROLE>.md to a live agent's ROLE.md.
#
# Safe to re-run: if the heading already exists in the live ROLE.md, no-op.
# Backs up live ROLE.md before any write.
#
# Usage:
#   update-agent-role-gstack.sh --agent <agent-id> [--dry-run] [--templates-dir DIR] [--agents-dir DIR] [--backup-dir DIR]
#
# Role resolution by agent-id suffix (case-insensitive):
#   *-ceo -> CEO; *-cto -> CTO; *-pm -> PM; *-po -> PO; *-qa -> QA;
#   *-uxui -> UXUI; *-staff-eng -> STAFF-ENG;
#   *-eng-backend -> ENG-BACKEND; *-eng-frontend -> ENG-FRONTEND;
#   *-eng-mobile -> ENG-MOBILE; *-eng-esp32 -> ENG-ESP32;
#   *-engineer -> ENGINEER;
#   *-book-author -> BOOK-AUTHOR; *-book-editor -> BOOK-EDITOR;
#   *-book-reviewer -> BOOK-REVIEWER; *-book-evaluator -> BOOK-EVALUATOR;
#   *-book-translator -> BOOK-TRANSLATOR;
#   cortex -> CORTEX
# Anything else: exits with UNRESOLVED.

set -euo pipefail

AGENT_ID=""
DRY_RUN=0
TEMPLATES_DIR="${TEMPLATES_DIR:-/opt/cortexos/templates/agent-roles}"
AGENTS_DIR="${AGENTS_DIR:-${HOME}/.openclaw/agents}"
BACKUP_DIR="${BACKUP_DIR:-/opt/cortexos/backups}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent) AGENT_ID="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --templates-dir) TEMPLATES_DIR="$2"; shift 2 ;;
    --agents-dir) AGENTS_DIR="$2"; shift 2 ;;
    --backup-dir) BACKUP_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -z "$AGENT_ID" ]] && { echo "ERR: --agent required" >&2; exit 2; }

resolve_role() {
  local id="$1"
  case "$id" in
    cortex) echo "CORTEX"; return ;;
  esac
  # ordered: longest suffix first
  case "$id" in
    *-book-author)    echo "BOOK-AUTHOR"; return ;;
    *-book-editor)    echo "BOOK-EDITOR"; return ;;
    *-book-reviewer)  echo "BOOK-REVIEWER"; return ;;
    *-book-evaluator) echo "BOOK-EVALUATOR"; return ;;
    *-book-translator) echo "BOOK-TRANSLATOR"; return ;;
    *-eng-backend)  echo "ENG-BACKEND"; return ;;
    *-eng-frontend) echo "ENG-FRONTEND"; return ;;
    *-eng-mobile)   echo "ENG-MOBILE"; return ;;
    *-eng-esp32)    echo "ENG-ESP32"; return ;;
    *-staff-eng)    echo "STAFF-ENG"; return ;;
    *-engineer)     echo "ENGINEER"; return ;;
    *-uxui)         echo "UXUI"; return ;;
    *-ceo)          echo "CEO"; return ;;
    *-cto)          echo "CTO"; return ;;
    *-pm)           echo "PM"; return ;;
    *-po)           echo "PO"; return ;;
    *-qa)           echo "QA"; return ;;
  esac
  echo "UNRESOLVED"
}

ROLE="$(resolve_role "$AGENT_ID")"
if [[ "$ROLE" == "UNRESOLVED" ]]; then
  echo "UNRESOLVED agent=$AGENT_ID" >&2
  exit 3
fi

TEMPLATE_FILE="$TEMPLATES_DIR/${ROLE}.md"

# Resolve live target: prefer standalone ROLE.md (cortex-style agents);
# fall back to embedded ROLE.md block inside CLAUDE.md (project-style agents).
ROLE_FILE="$AGENTS_DIR/$AGENT_ID/agent/ROLE.md"
CLAUDE_FILE="$AGENTS_DIR/$AGENT_ID/agent/CLAUDE.md"
if [[ -f "$ROLE_FILE" ]]; then
  LIVE_FILE="$ROLE_FILE"
  LIVE_KIND="role"
elif [[ -f "$CLAUDE_FILE" ]] && grep -q '^<!-- ROLE.md -->[[:space:]]*$' "$CLAUDE_FILE"; then
  LIVE_FILE="$CLAUDE_FILE"
  LIVE_KIND="claude-embedded"
else
  echo "ERR: no live ROLE.md or CLAUDE.md (with embedded ROLE.md block) for agent=$AGENT_ID" >&2
  exit 5
fi

[[ -f "$TEMPLATE_FILE" ]] || { echo "ERR: template missing: $TEMPLATE_FILE" >&2; exit 4; }

# Extract `## Gstack Workflows` section from the template (heading through EOF
# or until the next top-level `## ` heading — whichever comes first).
SECTION="$(awk '
  /^## Gstack Workflows[[:space:]]*$/ { capture=1 }
  capture && /^## / && !/^## Gstack Workflows[[:space:]]*$/ && NR>start { exit }
  capture { print; if (!start) start=NR }
' "$TEMPLATE_FILE")"

if [[ -z "$SECTION" ]]; then
  echo "ERR: template $TEMPLATE_FILE has no '## Gstack Workflows' section" >&2
  exit 6
fi

# Idempotency check
if grep -q '^## Gstack Workflows[[:space:]]*$' "$LIVE_FILE"; then
  echo "NOOP agent=$AGENT_ID role=$ROLE (already has Gstack Workflows)"
  exit 0
fi

TS="$(date +%Y%m%dT%H%M%S)"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/rebootstrap-${AGENT_ID}-${TS}.bak"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "DRY-RUN agent=$AGENT_ID role=$ROLE template=$TEMPLATE_FILE live=$LIVE_FILE backup=$BACKUP_FILE"
  echo "--- would append (first 10 lines) ---"
  printf '%s\n' "$SECTION" | head -10
  exit 0
fi

cp -a "$LIVE_FILE" "$BACKUP_FILE"

# Append section. Ensure trailing newline before heading.
{
  # Add blank line separator if file doesn't end in one.
  tail -c1 "$LIVE_FILE" | od -An -c | grep -q '\\n' || echo ""
  echo ""
  printf '%s\n' "$SECTION"
} >> "$LIVE_FILE"

BEFORE_LINES=$(wc -l < "$BACKUP_FILE")
AFTER_LINES=$(wc -l < "$LIVE_FILE")
echo "OK agent=$AGENT_ID role=$ROLE kind=$LIVE_KIND before=$BEFORE_LINES after=$AFTER_LINES backup=$BACKUP_FILE"
