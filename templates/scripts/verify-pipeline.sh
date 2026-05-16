#!/usr/bin/env bash
# verify-pipeline.sh
# Verify a project's .agents/ scaffolding and (optionally) VPS state. PASS/FAIL per check.

set -euo pipefail

PROJECT=""
REPO_PATH=""
VPS_HOST=""
TEMPLATES_DIR=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PASS=0
FAIL=0

usage() {
  cat >&2 <<'EOF'
Usage: verify-pipeline.sh --project <name> --repo-path <path> [--vps-host <ssh>] [--templates-dir <path>]
EOF
}

check_pass() { printf '  PASS  %s\n' "$*"; PASS=$((PASS+1)); }
check_fail() { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
section()    { printf '\n[%s]\n' "$*"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --repo-path) REPO_PATH="$2"; shift 2 ;;
    --vps-host) VPS_HOST="$2"; shift 2 ;;
    --templates-dir) TEMPLATES_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ -n "$PROJECT" ]]   || { usage; exit 2; }
[[ -n "$REPO_PATH" ]] || { usage; exit 2; }
[[ -d "$REPO_PATH" ]] || { echo "no repo at $REPO_PATH"; exit 2; }

if [[ -z "$TEMPLATES_DIR" ]]; then
  if [[ -d "$SCRIPT_DIR/../agent-factory" ]]; then
    TEMPLATES_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  fi
fi

REQUIRED_FILES=(
  SOUL.md IDENTITY.md BOOTSTRAP.md AGENTS.md ROLE.md
  TOOLS.md MEMORY.md HEARTBEAT.md USER.md WORKFLOW.md PIPELINE.md
)

section "agents-dir"
agents_root="$REPO_PATH/.agents"
if [[ -d "$agents_root" ]]; then
  check_pass ".agents/ exists"
else
  check_fail ".agents/ missing"; echo; echo "RESULT: FAIL"; exit 1
fi

# discover roles from filesystem
ROLE_DIRS=()
for d in "$agents_root"/*/; do
  [[ -d "$d" ]] && ROLE_DIRS+=("$d")
done

if [[ ${#ROLE_DIRS[@]} -eq 0 ]]; then
  check_fail "no role dirs under .agents/"
else
  check_pass "found ${#ROLE_DIRS[@]} role dir(s)"
fi

section "per-role files (${#REQUIRED_FILES[@]} required each)"
for d in "${ROLE_DIRS[@]}"; do
  role="$(basename "$d")"
  missing=()
  for f in "${REQUIRED_FILES[@]}"; do
    [[ -f "$d/$f" ]] || missing+=("$f")
  done
  if [[ ${#missing[@]} -eq 0 ]]; then
    check_pass "$role: all required files present"
  else
    check_fail "$role: missing ${missing[*]}"
  fi
done

section "github config"
if [[ -f "$REPO_PATH/.github/labels.yml" ]]; then
  check_pass "labels.yml exists"
  if [[ -n "$TEMPLATES_DIR" && -f "$TEMPLATES_DIR/labels.yml" ]]; then
    if diff -q "$REPO_PATH/.github/labels.yml" "$TEMPLATES_DIR/labels.yml" >/dev/null 2>&1; then
      check_pass "labels.yml matches template"
    else
      check_fail "labels.yml diverges from template (run regenerate)"
    fi
  fi
else
  check_fail "labels.yml missing"
fi

# Factory-created agents require workflow files for mention routing and gate checks.
for wf in workflow-pipeline.yml gate-enforcement.yml agent-mention-router.yml ai-review-request.yml; do
  if [[ -f "$REPO_PATH/.github/workflows/$wf" ]]; then
    check_pass "workflow $wf present"
  else
    check_fail "workflow $wf missing"
  fi
done

section "repo-root"
[[ -f "$REPO_PATH/AGENTS.md" ]] && check_pass "AGENTS.md present" || check_fail "AGENTS.md missing"
[[ -f "$REPO_PATH/CLAUDE.md" ]] && check_pass "CLAUDE.md present" || check_fail "CLAUDE.md missing"

if [[ -n "$VPS_HOST" ]]; then
  section "vps state ($VPS_HOST)"
  if ssh -o ConnectTimeout=5 -o BatchMode=yes "$VPS_HOST" true 2>/dev/null; then
    check_pass "ssh reachable"

    # openclaw.json agents
    count="$(ssh "$VPS_HOST" "jq -r '[.agents[]? | select(.id|tostring|startswith(\"${PROJECT}-\"))] | length' ~/.openclaw/openclaw.json 2>/dev/null || echo 0")"
    if [[ "${count:-0}" -gt 0 ]]; then
      check_pass "openclaw agents registered: $count"
    else
      check_fail "no openclaw agents matching ${PROJECT}-*"
    fi

    # bindings
    bcount="$(ssh "$VPS_HOST" "ls ~/.openclaw/bindings/${PROJECT}-*.json 2>/dev/null | wc -l | tr -d ' '")"
    if [[ "${bcount:-0}" -gt 0 ]]; then
      check_pass "bindings present: $bcount"
    else
      check_fail "no bindings for ${PROJECT}-*"
    fi

    # cron
    ccount="$(ssh "$VPS_HOST" "crontab -l 2>/dev/null | grep -c '${PROJECT}-' || true")"
    if [[ "${ccount:-0}" -gt 0 ]]; then
      check_pass "cron jobs: $ccount"
    else
      check_fail "no cron jobs for ${PROJECT}-*"
    fi

    # telegram routes (heuristic: grep config)
    if ssh "$VPS_HOST" "grep -r '${PROJECT}-' ~/.openclaw/telegram/ 2>/dev/null | head -1" | grep -q .; then
      check_pass "telegram routes wired"
    else
      check_fail "telegram routes not found for ${PROJECT}-*"
    fi
  else
    check_fail "ssh unreachable: $VPS_HOST"
  fi
fi

echo
echo "=========================="
echo "PASS: $PASS  FAIL: $FAIL"
echo "=========================="
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
