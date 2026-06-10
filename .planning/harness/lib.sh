# Shared helpers for harness scripts. Source only — do not execute.

HARNESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
ARTIFACTS_DIR="$HARNESS_DIR/artifacts"
mkdir -p "$ARTIFACTS_DIR"

die() { echo "FATAL: $*" >&2; exit 2; }

# Resolve to absolute path; hard-fail if missing or empty.
require_file() {
  local p
  p="$(readlink -f "$1" 2>/dev/null)" || die "cannot resolve path: $1"
  [ -f "$p" ] || die "file missing: $p"
  [ -s "$p" ] || die "file empty: $p"
  printf '%s\n' "$p"
}

# Strip ANSI/terminal control sequences (pi appends them) and carriage returns.
strip_ctrl() {
  sed -e 's/\x1b\[[0-9;?]*[a-zA-Z]//g' \
      -e 's/\x1b\][^\x07]*\x07//g' \
      -e 's/\x1b[()][AB012]//g' \
      -e 's/\x1b[=>]//g' | tr -d '\r'
}

# Next free numbered artifact path: next_artifact <stem> -> artifacts/<stem>-N.md
next_artifact() {
  local stem="$1" n=1
  while [ -e "$ARTIFACTS_DIR/${stem}-${n}.md" ]; do n=$((n+1)); done
  printf '%s\n' "$ARTIFACTS_DIR/${stem}-${n}.md"
}

# Dispatch one worker. dispatch <worker> <timeout-secs> <prompt-file> <log-file>
# Returns the CLI exit code. kimi rc=124 (timeout reap) is normalized to 0.
dispatch() {
  local worker="$1" tmo="$2" prompt_file="$3" log="$4" rc
  local prompt; prompt="$(cat "$prompt_file")"
  case "$worker" in
    m3)
      timeout -k 10 "$tmo" pi -p --provider minimax --model MiniMax-M3 --no-session "$prompt" \
        </dev/null 2>&1 | strip_ctrl > "$log"; rc=${PIPESTATUS[0]} ;;
    m27-hs)
      timeout -k 10 "$tmo" pi -p --provider minimax --model MiniMax-M2.7-highspeed --no-session -t read,bash "$prompt" \
        </dev/null 2>&1 | strip_ctrl > "$log"; rc=${PIPESTATUS[0]} ;;
    gpt-5.5)
      timeout -k 10 "$tmo" pi -p --provider openai-codex --model gpt-5.5 --no-session -nt "$prompt" \
        </dev/null 2>&1 | strip_ctrl > "$log"; rc=${PIPESTATUS[0]} ;;
    kimi)
      timeout -k 5 "$tmo" kimi -p "$prompt" \
        </dev/null 2>&1 | strip_ctrl > "$log"; rc=${PIPESTATUS[0]}
      # kimi lingers after finishing; timeout reap is not failure.
      [ "$rc" = "124" ] && rc=0 ;;
    *) die "unknown worker: $worker (expected kimi|m3|m27-hs|gpt-5.5)" ;;
  esac
  return "$rc"
}
