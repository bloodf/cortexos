#!/usr/bin/env bash
set -euo pipefail

unset PYTHONPATH
unset PYTHONHOME

export HOME=/home/cortexos
export PATH=/home/cortexos/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/snap/bin

if [[ -f /home/cortexos/.hermes/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /home/cortexos/.hermes/.env
  set +a
fi

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
