#!/usr/bin/env bash
# Adversarial gates.
# Usage:
#   run-critic.sh plan <doc> [context-files...]
#       gpt-5.5 reviews a plan/analysis doc before use. Context files are
#       embedded so findings rest on evidence, not guesses.
#   run-critic.sh diff <plan> <git-base> [path-filters...]
#       kimi reviews the diff <git-base>..HEAD against the plan, scoped to
#       path-filters when given.
# Exit: 0 PASS, 1 REJECT, 2 no verdict / dispatch failure.
# Artifact: artifacts/critic-{plan|diff}-<name>-N.md
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

MODE="${1:?usage: run-critic.sh plan|diff ...}"; shift
CONTRACT="$(require_file "$HARNESS_DIR/prompts/critic-contract.md")"
PLAN_TIMEOUT="${CRITIC_PLAN_TIMEOUT:-600}"
DIFF_TIMEOUT="${CRITIC_DIFF_TIMEOUT:-600}"

embed() { # embed <label> <file>
  printf '\n<file path="%s">\n' "$2"
  cat "$2"
  printf '\n</file>\n'
}

case "$MODE" in
plan)
  DOC="$(require_file "${1:?run-critic.sh plan <doc> [context...]}")"; shift
  STEM="critic-plan-$(basename "$DOC" | tr -c 'A-Za-z0-9._-' '-' | sed 's/-*$//')"
  ART="$(next_artifact "$STEM")"
  PROMPT_FILE="$(mktemp)"
  trap 'rm -f "$PROMPT_FILE"' EXIT
  {
    echo "You are an adversarial plan reviewer. Reject weak plans; a false PASS costs more than a false REJECT."
    echo "Review the document below for: untraceable requirements (no file:line evidence), missing or non-binary acceptance criteria, missing file-ownership boundaries, tasks not TDD-ordered, missing out-of-scope list, internal contradictions, claims unsupported by the embedded context."
    cat "$CONTRACT"
    echo
    echo "## Document under review"
    embed doc "$DOC"
    if [ "$#" -gt 0 ]; then
      echo "## Context files (evidence base)"
      for c in "$@"; do embed ctx "$(require_file "$c")"; done
    fi
  } > "$PROMPT_FILE"
  echo "[run-critic] plan gate: doc=$DOC artifact=$ART"
  dispatch gpt-5.5 "$PLAN_TIMEOUT" "$PROMPT_FILE" "$ART" || true
  ;;
diff)
  PLAN="$(require_file "${1:?run-critic.sh diff <plan> <git-base> [filters...]}")"
  BASE="${2:?run-critic.sh diff <plan> <git-base> [filters...]}"; shift 2
  git -C "$REPO_ROOT" rev-parse --verify --quiet "$BASE" >/dev/null || die "bad git base: $BASE"
  STEM="critic-diff-$(git -C "$REPO_ROOT" rev-parse --short "$BASE")"
  ART="$(next_artifact "$STEM")"
  DIFF_FILE="$ARTIFACTS_DIR/$(basename "$ART" .md).diff"
  if [ "$#" -gt 0 ]; then
    git -C "$REPO_ROOT" diff "$BASE" -- "$@" > "$DIFF_FILE"
  else
    git -C "$REPO_ROOT" diff "$BASE" > "$DIFF_FILE"
  fi
  [ -s "$DIFF_FILE" ] || die "diff $BASE..HEAD is empty (filters: $*) — nothing to review"
  PROMPT_FILE="$(mktemp)"
  trap 'rm -f "$PROMPT_FILE"' EXIT
  {
    echo "You are an adversarial diff reviewer. Do not run tools or modify files; everything you need is embedded below."
    echo "Review the diff against the plan for: changes outside the plan's file-ownership section, tasks implemented without their failing test, acceptance criteria not met by the diff, defects introduced (logic, error handling, security), plan tasks silently skipped."
    cat "$CONTRACT"
    echo
    echo "## Plan"
    embed plan "$PLAN"
    echo "## Diff under review (git diff $BASE..HEAD)"
    embed diff "$DIFF_FILE"
  } > "$PROMPT_FILE"
  echo "[run-critic] diff gate: plan=$PLAN base=$BASE artifact=$ART"
  dispatch kimi "$DIFF_TIMEOUT" "$PROMPT_FILE" "$ART" || true
  ;;
*)
  die "unknown mode: $MODE (expected plan|diff)"
  ;;
esac

"$HARNESS_DIR/parse-verdict.sh" "$ART"
RC=$?
echo "[run-critic] artifact=$ART rc=$RC"
exit "$RC"
