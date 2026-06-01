#!/usr/bin/env bash
set -euo pipefail

unset PYTHONPATH
unset PYTHONHOME

export HOME=/home/cortexos
export PATH=/home/cortexos/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/snap/bin

_pre_openai_api_key="${OPENAI_API_KEY:-}"
_pre_openai_base_url="${OPENAI_BASE_URL:-}"
_pre_ninerouter_api_key="${NINEROUTER_API_KEY:-}"
if [[ -f /home/cortexos/.hermes/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /home/cortexos/.hermes/.env
  set +a
fi
if [[ -f /opt/cortexos/.secrets/9router.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /opt/cortexos/.secrets/9router.env
  set +a
fi
if [[ -f /opt/cortexos/.secrets/paperclip.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /opt/cortexos/.secrets/paperclip.env
  set +a
fi
[[ -n "$_pre_openai_api_key" ]] && export OPENAI_API_KEY="$_pre_openai_api_key"
[[ -n "$_pre_openai_base_url" ]] && export OPENAI_BASE_URL="$_pre_openai_base_url"
[[ -n "$_pre_ninerouter_api_key" ]] && export NINEROUTER_API_KEY="$_pre_ninerouter_api_key"

is_bad_env_value() {
  local value="${1:-}"
  [[ -z "$value" || "$value" == "[object Object]" || "$value" == "undefined" || "$value" == "null" ]]
}

model=""
prev=""
for arg in "$@"; do
  if [[ "$prev" == "-m" || "$prev" == "--model" ]]; then
    model="$arg"
    break
  fi
  if [[ "$arg" == --model=* ]]; then
    model="${arg#--model=}"
    break
  fi
  prev="$arg"
done

inject_paperclip_auth_guard() {
  local prompt="$1"
  printf "%s" "$prompt" | /usr/bin/python3 /opt/cortexos/scripts/paperclip-prompt-guard.py
}

normalized_args=()
prev=""
provider_seen=0
skip_next_resume=0
for arg in "$@"; do
  if [[ "$skip_next_resume" == 1 ]]; then
    skip_next_resume=0
    prev=""
    continue
  fi

  if [[ "$arg" == "--resume" ]]; then
    skip_next_resume=1
    prev=""
    continue
  fi

  if [[ "$arg" == --resume=* ]]; then
    prev=""
    continue
  fi

  if [[ "$prev" == "-q" || "$prev" == "--query" ]]; then
    normalized_args+=("$(inject_paperclip_auth_guard "$arg")")
    prev=""
    continue
  fi

  if [[ "$prev" == "--provider" ]]; then
    normalized_args+=("custom")
    provider_seen=1
    prev=""
    continue
  fi

  case "$arg" in
    --provider=*)
      normalized_args+=("--provider=custom")
      provider_seen=1
      ;;
    --provider)
      normalized_args+=("$arg")
      prev="--provider"
      ;;
    -q|--query)
      normalized_args+=("$arg")
      prev="$arg"
      ;;
    *)
      normalized_args+=("$arg")
      prev=""
      ;;
  esac
done
if [[ "$provider_seen" == 0 ]]; then
  normalized_args+=("--provider" "custom")
fi

args_text="${normalized_args[*]}"

profile="${HERMES_PROFILE:-primary}"
if is_bad_env_value "$profile"; then
  case "$args_text" in
    *0b96ba9b-87c5-4e69-89ca-188782d40d5f*) profile="celebrar" ;;
    *a163ef00-71bb-4412-8943-c109f58a60a7*) profile="mementry" ;;
    *a24e39b2-2ede-4aec-9471-248458a381fc*) profile="3guns" ;;
    *cieucpb*|*CIEUCPB*) profile="cieucpb" ;;
    *) profile="primary" ;;
  esac
fi

export HERMES_PROFILE="$profile"
export HERMES_HOME="/opt/cortexos/hermes/profiles/$profile"

if [[ -f "$HERMES_HOME/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$HERMES_HOME/.env"
  set +a
fi

if is_bad_env_value "${OPENAI_BASE_URL:-}"; then
  export OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
fi

if is_bad_env_value "${HERMES_FALLBACK_BASE_URL:-}"; then
  export HERMES_FALLBACK_BASE_URL="http://127.0.0.1:11434/v1"
fi

if is_bad_env_value "${HERMES_FALLBACK_MODEL:-}"; then
  case "$model" in
    cc/claude-opus-4-7) export HERMES_FALLBACK_MODEL="cx/gpt-5.5" ;;
    cx/gpt-5.5) export HERMES_FALLBACK_MODEL="kimi/kimi-k2.6" ;;
    kimi/kimi-k2.6) export HERMES_FALLBACK_MODEL="cx/gpt-5.5" ;;
    *m2.7*|*M2.7*) export HERMES_FALLBACK_MODEL="zai/glm-5.1" ;;
    *) unset HERMES_FALLBACK_MODEL ;;
  esac
fi

runtime_home=""
if [[ -n "${HERMES_FALLBACK_MODEL:-}" ]]; then
  runtime_home="$(/usr/bin/python3 /opt/cortexos/scripts/hermes-runtime-home.py "$HERMES_HOME" "$HERMES_FALLBACK_MODEL")"
  export HERMES_HOME="$runtime_home"
fi

paperclip_lock_issue_id=""
paperclip_lock_arg_next=0
for arg in "${normalized_args[@]}"; do
  if [[ "$paperclip_lock_arg_next" == 1 ]]; then
    paperclip_lock_issue_id="$arg"
    break
  fi
  case "$arg" in
    --paperclip-issue-id=*) paperclip_lock_issue_id="${arg#--paperclip-issue-id=}"; break ;;
    --paperclip-issue-id) paperclip_lock_arg_next=1 ;;
    *issueId*)
      if [[ "$arg" =~ issueId[\"\':=[:space:]]+([0-9a-fA-F-]{36}) ]]; then
        paperclip_lock_issue_id="${BASH_REMATCH[1]}"
        break
      fi
      ;;
  esac
done

paperclip_lock_fd=""
if [[ -n "$paperclip_lock_issue_id" ]]; then
  lock_dir="/opt/cortexos/paperclip/run/issue-runner-locks"
  mkdir -p "$lock_dir"
  lock_file="$lock_dir/${paperclip_lock_issue_id}.lock"
  exec {paperclip_lock_fd}>"$lock_file"
  if ! flock -n "$paperclip_lock_fd"; then
    printf "ts=%s issue_id=%s event=duplicate_runner_skipped\n" "$(date -Is)" "$paperclip_lock_issue_id" >> /opt/cortexos/paperclip/hermes-wrapper.log
    exit 75
  fi
  printf '%s\n' "$$" > "$lock_file.pid"
fi

{
  printf "ts=%s profile=%s hermes_home=%s home=%s args=" "$(date -Is)" "${HERMES_PROFILE:-}" "${HERMES_HOME:-}" "${HOME:-}"
  printf "%q " "${normalized_args[@]}"
  printf "\n"
} >> /opt/cortexos/paperclip/hermes-wrapper.log

# --- Paperclip heartbeat preflight (GUN-191 / GUN-192) ---
# Fail fast with a distinct exit code when the per-agent paperclipApiUrl in
# the heartbeat prompt is unreachable, instead of letting the hermes child
# blow up later with the generic process_lost recovery.
# Skipped silently when (a) the prompt is not a Paperclip heartbeat or (b)
# the env opt-out PAPERCLIP_PREFLIGHT_DISABLE=1 is set.
if [[ "${PAPERCLIP_PREFLIGHT_DISABLE:-0}" != "1" ]]; then
  preflight_prompt=""
  prev=""
  for a in "${normalized_args[@]}"; do
    if [[ "$prev" == "-q" || "$prev" == "--query" ]]; then
      preflight_prompt="$a"
      break
    fi
    prev="$a"
  done
  if [[ -n "$preflight_prompt" ]]; then
    set +e
    printf "%s" "$preflight_prompt" | /usr/bin/python3 /opt/cortexos/scripts/paperclip-heartbeat-preflight.py
    preflight_rc=$?
    set -e
    # 0 = ok, 77 = not a paperclip heartbeat. Anything else = real failure.
    if [[ "$preflight_rc" != "0" && "$preflight_rc" != "77" ]]; then
      printf "ts=%s event=paperclip_preflight_blocked rc=%s\n" "$(date -Is)" "$preflight_rc" \
        >> /opt/cortexos/paperclip/hermes-wrapper.log
      # Release the issue lock cleanly so the recovery layer is not stuck.
      if [[ -n "${paperclip_lock_issue_id:-}" ]]; then
        rm -f "/opt/cortexos/paperclip/run/issue-runner-locks/${paperclip_lock_issue_id}.lock.pid"
      fi
      exit "$preflight_rc"
    fi
  fi
fi
# --- end preflight ---

cleanup_paperclip_lock() {
  if [[ -n "${paperclip_lock_issue_id:-}" ]]; then
    rm -f "/opt/cortexos/paperclip/run/issue-runner-locks/${paperclip_lock_issue_id}.lock.pid"
  fi
  if [[ -n "${runtime_home:-}" && "$runtime_home" == /tmp/hermes-paperclip-* ]]; then
    rm -rf "$runtime_home"
  fi
}
trap cleanup_paperclip_lock EXIT

/home/cortexos/.local/bin/hermes "${normalized_args[@]}" 2> >(/usr/bin/python3 /opt/cortexos/scripts/hermes-stderr-filter.py)
exit "$?"
