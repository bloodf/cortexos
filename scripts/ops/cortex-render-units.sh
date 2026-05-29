#!/usr/bin/env bash
# cortex-render-units.sh — materialize CortexOS systemd unit templates.
#
# Substitutes {PLACEHOLDER} tokens in templates/systemd/*.service and
# installs the rendered units into /etc/systemd/system, then daemon-reload.
# This is the materialization step that was previously missing: templates
# shipped with literal {VPS_USER}/{CORTEX_ROOT}/... tokens and, if copied
# verbatim, systemd rejects them ("EnvironmentFile path is not absolute",
# "Unit configuration has fatal error, unit will not be started").
#
# Idempotent. Re-running re-renders from the templates.
#
# Usage:
#   cortex-render-units.sh                 # render all templates/systemd/*.service
#   cortex-render-units.sh hermes-profile@.service 9router.service   # subset
#   DRY_RUN=1 cortex-render-units.sh       # print rendered output, install nothing
#
# Overridable substitution values (defaults match the canonical host layout):
#   VPS_USER VPS_HOME CORTEX_ROOT CORTEX_HERMES_ROOT CORTEX_SECRETS_DIR
#   NPM_PREFIX NODE_BIN_DIR
set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
TEMPLATE_DIR="${TEMPLATE_DIR:-${CORTEX_ROOT}/templates/systemd}"
UNIT_DIR="${UNIT_DIR:-/etc/systemd/system}"
DRY_RUN="${DRY_RUN:-0}"

VPS_USER="${VPS_USER:-cortexos}"
VPS_HOME="${VPS_HOME:-/home/${VPS_USER}}"
CORTEX_HERMES_ROOT="${CORTEX_HERMES_ROOT:-${CORTEX_ROOT}/hermes}"
CORTEX_SECRETS_DIR="${CORTEX_SECRETS_DIR:-${CORTEX_ROOT}/.secrets}"
# CORTEX_RUNTIME_ROOT is a legacy alias for CORTEX_ROOT in older templates.
CORTEX_RUNTIME_ROOT="${CORTEX_RUNTIME_ROOT:-${CORTEX_ROOT}}"
HERMES_COMMAND="${HERMES_COMMAND:-${VPS_HOME}/.local/bin/hermes}"
NPM_PREFIX="${NPM_PREFIX:-$(npm prefix -g 2>/dev/null || echo /usr)}"
NODE_BIN_DIR="${NODE_BIN_DIR:-$(dirname "$(command -v node 2>/dev/null || echo /usr/bin/node)")}"

log() { printf '[render-units] %s\n' "$*"; }

render_one() {
  local tpl="$1" name rendered
  name="$(basename "$tpl")"
  rendered="$(sed \
    -e "s|{VPS_USER}|${VPS_USER}|g" \
    -e "s|{VPS_HOME}|${VPS_HOME}|g" \
    -e "s|{CORTEX_SECRETS_DIR}|${CORTEX_SECRETS_DIR}|g" \
    -e "s|{CORTEX_HERMES_ROOT}|${CORTEX_HERMES_ROOT}|g" \
    -e "s|{CORTEX_RUNTIME_ROOT}|${CORTEX_RUNTIME_ROOT}|g" \
    -e "s|{CORTEX_ROOT}|${CORTEX_ROOT}|g" \
    -e "s|{HERMES_COMMAND}|${HERMES_COMMAND}|g" \
    -e "s|{NPM_PREFIX}|${NPM_PREFIX}|g" \
    -e "s|{NODE_BIN_DIR}|${NODE_BIN_DIR}|g" \
    "$tpl")"
  local leftover
  leftover="$(printf '%s' "$rendered" | grep -oE '\{[A-Z_]+\}' | sort -u | paste -sd, - || true)"
  if [ -n "$leftover" ]; then
    echo "ERROR: ${name} has unresolved placeholders: ${leftover}" >&2
    return 1
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "----- ${name} -----"; printf '%s\n' "$rendered"; return 0
  fi
  printf '%s\n' "$rendered" | sudo tee "${UNIT_DIR}/${name}" >/dev/null
  log "installed ${UNIT_DIR}/${name}"
}

main() {
  local -a templates
  if [ "$#" -gt 0 ]; then
    for n in "$@"; do templates+=("${TEMPLATE_DIR}/${n}"); done
  else
    for f in "${TEMPLATE_DIR}"/*.service "${TEMPLATE_DIR}"/*.timer "${TEMPLATE_DIR}"/*.socket; do
      [ -e "$f" ] && templates+=("$f")
    done
  fi
  local rc=0
  for t in "${templates[@]}"; do
    [ -f "$t" ] || { echo "missing template: $t" >&2; rc=1; continue; }
    render_one "$t" || rc=1
  done
  if [ "$DRY_RUN" != "1" ] && [ "$rc" -eq 0 ]; then
    sudo systemctl daemon-reload && log "daemon-reload done"
  fi
  return "$rc"
}

main "$@"
