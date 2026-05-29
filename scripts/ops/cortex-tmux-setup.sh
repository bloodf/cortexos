#!/usr/bin/env bash
# cortex-tmux-setup.sh — materialize the CortexOS tmux environment.
#
# Idempotent. Installs TPM + the plugin set, drops the canonical
# ~/.tmux.conf, installs plugins non-interactively, and creates the
# named sessions defined in manifests/rebuild/tmux-session-model.tsv.
#
# Sources of truth (in the materialized repo tree at $CORTEX_ROOT):
#   - stacks/cortex-incus/tmux.conf          → ~/.tmux.conf
#   - manifests/rebuild/tmux-session-model.tsv → session list
#
# Usage:  cortex-tmux-setup.sh               # full setup (conf + plugins + sessions)
#         cortex-tmux-setup.sh --no-plugins  # conf + sessions only (no external TPM clone)
#         cortex-tmux-setup.sh --no-sessions # conf + plugins only
#
# --no-plugins skips cloning github.com/tmux-plugins/tpm and running its
# installer; use it when external code must not run on the host. The
# @plugin lines in ~/.tmux.conf are inert until TPM is present.
set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
TMUX_CONF_SRC="${CORTEX_ROOT}/stacks/cortex-incus/tmux.conf"
SESSION_MODEL="${CORTEX_ROOT}/manifests/rebuild/tmux-session-model.tsv"
TPM_DIR="${HOME}/.tmux/plugins/tpm"
MAKE_SESSIONS=1
MAKE_PLUGINS=1
for arg in "$@"; do
  case "${arg}" in
    --no-sessions) MAKE_SESSIONS=0 ;;
    --no-plugins)  MAKE_PLUGINS=0 ;;
  esac
done

log() { printf '[cortex-tmux] %s\n' "$*"; }

command -v tmux >/dev/null || { echo "tmux not installed" >&2; exit 1; }

# 1. TPM (external; skippable)
if [ "${MAKE_PLUGINS}" -eq 1 ]; then
  command -v git >/dev/null || { echo "git not installed" >&2; exit 1; }
  if [ ! -d "${TPM_DIR}/.git" ]; then
    log "cloning TPM"
    git clone --depth 1 https://github.com/tmux-plugins/tpm "${TPM_DIR}"
  else
    log "TPM present; pulling"
    git -C "${TPM_DIR}" pull --ff-only --quiet || true
  fi
else
  log "skipping TPM/plugin install (--no-plugins)"
fi

# 2. ~/.tmux.conf
if [ -f "${TMUX_CONF_SRC}" ]; then
  if [ -f "${HOME}/.tmux.conf" ] && ! cmp -s "${TMUX_CONF_SRC}" "${HOME}/.tmux.conf"; then
    cp "${HOME}/.tmux.conf" "${HOME}/.tmux.conf.bak-$(date +%Y%m%dT%H%M%S)"
    log "backed up existing ~/.tmux.conf"
  fi
  install -m 0644 "${TMUX_CONF_SRC}" "${HOME}/.tmux.conf"
  log "installed ~/.tmux.conf"
else
  echo "missing ${TMUX_CONF_SRC}" >&2; exit 1
fi

# 3. install plugins (non-interactive)
if [ "${MAKE_PLUGINS}" -eq 1 ]; then
  log "installing tmux plugins via TPM"
  "${TPM_DIR}/bin/install_plugins" || log "plugin install reported non-zero (often benign)"
fi

# 4. named sessions
if [ "${MAKE_SESSIONS}" -eq 1 ] && [ -f "${SESSION_MODEL}" ]; then
  log "creating named sessions"
  # columns: session  scope  owner  purpose  restore_policy  notes
  while IFS=$'\t' read -r session scope _owner _purpose _policy _notes; do
    case "${session}" in ''|'#'*) continue;; esac
    if tmux has-session -t "${session}" 2>/dev/null; then
      log "  session ${session} exists — skip"
      continue
    fi
    tmux new-session -d -s "${session}" -n main
    if [ "${scope}" = "project-instance" ]; then
      # Pre-load (do not execute) the Tailscale SSH into the instance.
      tmux send-keys -t "${session}" "ssh cortexos@${session}" # no Enter — operator confirms
    fi
    log "  created ${session} (${scope})"
  done < "${SESSION_MODEL}"
else
  log "skipping session creation"
fi

log "done. Attach with: tmux attach -t cortex-host"
