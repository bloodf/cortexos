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

[[ -n "$_pre_openai_api_key" ]] && export OPENAI_API_KEY="$_pre_openai_api_key"
[[ -n "$_pre_openai_base_url" ]] && export OPENAI_BASE_URL="$_pre_openai_base_url"
[[ -n "$_pre_ninerouter_api_key" ]] && export NINEROUTER_API_KEY="$_pre_ninerouter_api_key"

profile="${HERMES_PROFILE:-primary}"

export HERMES_PROFILE="$profile"
export HERMES_HOME="/opt/cortexos/hermes/profiles/$profile"

if [[ -f "$HERMES_HOME/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$HERMES_HOME/.env"
  set +a
fi

{
  printf "ts=%s profile=%s hermes_home=%s home=%s args=" "$(date -Is)" "${HERMES_PROFILE:-}" "${HERMES_HOME:-}" "${HOME:-}"
  printf "%q " "$@"
  printf "\n"
} >> /opt/cortexos/paperclip/hermes-wrapper.log

exec /home/cortexos/.local/bin/hermes "$@"
