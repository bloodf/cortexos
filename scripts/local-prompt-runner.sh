#!/usr/bin/env bash
# scripts/local-prompt-runner.sh — run operator prompts non-interactively.
#
# Drives a sequence of markdown prompts by extracting fenced ```bash blocks
# and executing them. Intended to run INSIDE a rehearsal VM (or any Linux
# host) under `vagrant ssh`.
#
# Flags:
#   --family <ubuntu|fedora|rhel>   sets CORTEX_OS_FAMILY for the run
#   --prompts <spec>                comma list of items; each item is either
#                                   a single prompt path (relative to
#                                   prompts/, no .md) or a RANGE expressed
#                                   as "<dir>/<start>..<dir>/<end>" where
#                                   start/end are filename prefixes.
#                                   e.g.  "os/00,tools/00..tools/99"
#   --from <name>                   skip until this prompt basename
#   --dry-run                       list resolved prompts; do not execute
#
# A fenced block is skipped if it is opened as ```bash skip``` OR if its
# body contains a line matching `# rehearsal: skip`.
#
# Output: per-prompt logs in /tmp/cortexos-rehearsal/<basename>.log
# Final line on stdout: JSON summary.

set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
PROMPTS_DIR="${CORTEX_ROOT}/prompts"
LOG_DIR="/tmp/cortexos-rehearsal"
mkdir -p "${LOG_DIR}"

FAMILY=""
PROMPT_SPEC=""
FROM=""
DRY_RUN=0

die() { printf 'error: %s\n' "$*" >&2; exit 2; }

while [ $# -gt 0 ]; do
  case "$1" in
    --family)  FAMILY="${2:-}"; shift 2 ;;
    --prompts) PROMPT_SPEC="${2:-}"; shift 2 ;;
    --from)    FROM="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help)
      sed -n '2,30p' "$0"; exit 0 ;;
    *) die "unknown flag: $1" ;;
  esac
done

[ -n "${FAMILY}" ]      || die "--family required"
[ -n "${PROMPT_SPEC}" ] || die "--prompts required"
[ -d "${PROMPTS_DIR}" ] || die "prompts dir not found: ${PROMPTS_DIR}"

export CORTEX_OS_FAMILY="${FAMILY}"

# --- prompt resolution ------------------------------------------------------

resolve_range() {
  # "<dir>/<start>..<dir>/<end>" → list of matching files in prompts/<dir>
  local spec="$1"
  local left="${spec%%..*}"
  local right="${spec##*..}"
  local dir="${left%%/*}"
  local lo="${left#*/}"
  local hi="${right#*/}"

  local f base prefix
  for f in $(ls "${PROMPTS_DIR}/${dir}"/*.md 2>/dev/null | sort); do
    base="$(basename "${f}" .md)"
    prefix="${base%%-*}"
    if [ "${prefix}" \> "${hi}" ]; then continue; fi
    if [ "${prefix}" \< "${lo}" ]; then continue; fi
    printf '%s/%s\n' "${dir}" "${base}"
  done
}

resolve_single() {
  # "<dir>/<basename-prefix>" → matching files (handles family suffixes).
  local item="$1"
  local dir="${item%%/*}"
  local stem="${item#*/}"
  local f base
  for f in $(ls "${PROMPTS_DIR}/${dir}"/*.md 2>/dev/null | sort); do
    base="$(basename "${f}" .md)"
    case "${base}" in
      "${stem}"|"${stem}-"*) printf '%s/%s\n' "${dir}" "${base}" ;;
    esac
  done
}

resolve_spec() {
  local IFS=','
  for item in ${PROMPT_SPEC}; do
    case "${item}" in
      *..*) resolve_range "${item}" ;;
      *)    resolve_single "${item}" ;;
    esac
  done
}

mapfile -t RESOLVED < <(resolve_spec)

if [ -n "${FROM}" ]; then
  filtered=()
  seen=0
  for p in "${RESOLVED[@]}"; do
    base="$(basename "${p}")"
    if [ "${seen}" -eq 0 ] && [ "${base}" = "${FROM}" ]; then seen=1; fi
    [ "${seen}" -eq 1 ] && filtered+=("${p}")
  done
  RESOLVED=("${filtered[@]}")
fi

if [ "${#RESOLVED[@]}" -eq 0 ]; then
  printf '{"result":"fail","prompts_run":[],"failure":{"reason":"no prompts matched"}}\n'
  exit 1
fi

if [ "${DRY_RUN}" -eq 1 ]; then
  printf 'dry-run resolved prompts:\n'
  printf '  %s\n' "${RESOLVED[@]}"
  printf '{"result":"pass","prompts_run":['
  sep=""
  for p in "${RESOLVED[@]}"; do printf '%s"%s"' "${sep}" "${p}"; sep=","; done
  printf '],"failure":null,"dry_run":true}\n'
  exit 0
fi

# --- block extraction & execution ------------------------------------------

extract_blocks() {
  # Emits a stream where each block is delimited by:
  #   <<<BLOCK n SKIP=0|1>>>
  #   ...lines...
  #   <<<ENDBLOCK>>>
  awk '
    BEGIN { in_block = 0; n = 0; skip = 0 }
    /^```bash([[:space:]]+skip)?[[:space:]]*$/ {
      in_block = 1
      n += 1
      skip = ($0 ~ /skip/) ? 1 : 0
      printf "<<<BLOCK %d SKIP=%d>>>\n", n, skip
      next
    }
    /^```[[:space:]]*$/ && in_block == 1 {
      in_block = 0
      print "<<<ENDBLOCK>>>"
      next
    }
    in_block == 1 { print }
  ' "$1"
}

run_prompt() {
  local rel="$1"
  local file="${PROMPTS_DIR}/${rel}.md"
  local base
  base="$(basename "${rel}")"
  local log="${LOG_DIR}/${base}.log"
  : > "${log}"

  [ -r "${file}" ] || { printf 'prompt unreadable: %s\n' "${file}" >>"${log}"; return 90; }

  local stream
  stream="$(extract_blocks "${file}")"

  local idx=0
  local body=""
  local skip=0
  local in=0
  local line
  while IFS= read -r line; do
    case "${line}" in
      "<<<BLOCK "*)
        idx=$(( idx + 1 ))
        skip=0
        case "${line}" in *"SKIP=1>>>") skip=1 ;; esac
        body=""
        in=1
        ;;
      "<<<ENDBLOCK>>>")
        in=0
        if [ "${skip}" -eq 1 ] || printf '%s' "${body}" | grep -qE '^[[:space:]]*#[[:space:]]*rehearsal:[[:space:]]*skip'; then
          printf -- '--- block %d SKIPPED ---\n' "${idx}" >>"${log}"
          continue
        fi
        printf -- '--- block %d ---\n' "${idx}" >>"${log}"
        if ! (
          set -euo pipefail
          export CORTEX_OS_FAMILY="${FAMILY}"
          export CORTEX_ROOT="${CORTEX_ROOT}"
          eval "${body}"
        ) >>"${log}" 2>&1; then
          printf 'BLOCK_FAIL idx=%d exit=$?\n' "${idx}" >>"${log}"
          echo "${idx}"
          return 1
        fi
        ;;
      *)
        [ "${in}" -eq 1 ] && body="${body}${line}"$'\n'
        ;;
    esac
  done <<<"${stream}"

  return 0
}

RAN=()
for rel in "${RESOLVED[@]}"; do
  RAN+=("${rel}")
  if failure_idx="$(run_prompt "${rel}")"; then
    :
  else
    rc=$?
    [ -z "${failure_idx}" ] && failure_idx=0
    printf '{"result":"fail","prompts_run":['
    sep=""
    for p in "${RAN[@]}"; do printf '%s"%s"' "${sep}" "${p}"; sep=","; done
    printf '],"failure":{"prompt":"%s","block_idx":%s,"exit":%d}}\n' "${rel}" "${failure_idx}" "${rc}"
    exit 1
  fi
done

printf '{"result":"pass","prompts_run":['
sep=""
for p in "${RAN[@]}"; do printf '%s"%s"' "${sep}" "${p}"; sep=","; done
printf '],"failure":null}\n'
