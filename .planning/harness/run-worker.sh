#!/usr/bin/env bash
# Dispatch one worker job from a job spec.
# Usage: run-worker.sh <job.json>
# Job spec: {"id": "...", "worker": "kimi|m3|m27-hs|gpt-5.5",
#            "timeout": 600, "prompt_file": "path", "expected_outputs": ["path", ...]}
# Exit: 0 = CLI ran and every expected output exists non-empty; 1 = failure.
# Output log: artifacts/<id>.log (control sequences stripped).
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

JOB_FILE="$(require_file "${1:?usage: run-worker.sh <job.json>}")"

jget() {
  python3 -c '
import json, sys
j = json.load(open(sys.argv[1]))
v = j.get(sys.argv[2], "")
if isinstance(v, list):
    print("\n".join(v))
else:
    print(v)
' "$JOB_FILE" "$1"
}

ID="$(jget id)";            [ -n "$ID" ] || die "job missing id"
WORKER="$(jget worker)";    [ -n "$WORKER" ] || die "job missing worker"
TMO="$(jget timeout)";      [ -n "$TMO" ] || TMO=600
PROMPT_FILE="$(require_file "$(jget prompt_file)")"
mapfile -t EXPECTED < <(jget expected_outputs | sed '/^$/d')

LOG="$ARTIFACTS_DIR/$ID.log"
echo "[run-worker] job=$ID worker=$WORKER timeout=${TMO}s prompt=$PROMPT_FILE"
echo "[run-worker] log=$LOG"

# Snapshot pre-dispatch state of expected outputs: a pre-existing file (e.g.
# a continuation job's report) must CHANGE during the job, or the job did
# nothing and "exists non-empty" would false-PASS.
declare -A PRESTATE
for out in "${EXPECTED[@]}"; do
  abs="$(readlink -f "$out" 2>/dev/null || true)"
  if [ -n "$abs" ] && [ -e "$abs" ]; then
    PRESTATE["$out"]="$(stat -c '%Y:%s' "$abs" 2>/dev/null || echo absent)"
  else
    PRESTATE["$out"]=absent
  fi
done

dispatch "$WORKER" "$TMO" "$PROMPT_FILE" "$LOG"
RC=$?
echo "[run-worker] cli rc=$RC ($(wc -c < "$LOG") bytes logged)"

FAIL=0
for out in "${EXPECTED[@]}"; do
  abs="$(readlink -f "$out" 2>/dev/null || true)"
  if [ -n "$abs" ] && [ -s "$abs" ]; then
    now="$(stat -c '%Y:%s' "$abs" 2>/dev/null || echo gone)"
    if [ "${PRESTATE[$out]}" != "absent" ] && [ "$now" = "${PRESTATE[$out]}" ]; then
      echo "[run-worker] output UNCHANGED (pre-existing, job made no progress): $abs"
      FAIL=1
    else
      echo "[run-worker] output OK: $abs"
    fi
  else
    echo "[run-worker] output MISSING/EMPTY: $out"
    FAIL=1
  fi
done

if [ "$RC" -ne 0 ] && [ "${#EXPECTED[@]}" -eq 0 ]; then
  # No file side effects to judge by; CLI exit code is the only signal.
  FAIL=1
fi
[ -s "$LOG" ] || { echo "[run-worker] log is empty — treat as silent death; dispatch a CONTINUATION job"; FAIL=1; }

if [ "$FAIL" -eq 0 ]; then
  echo "[run-worker] RESULT: PASS"
  exit 0
fi
echo "[run-worker] RESULT: FAIL"
exit 1
