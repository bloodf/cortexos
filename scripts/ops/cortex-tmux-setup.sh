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
#         cortex-tmux-setup.sh --no-selfcheck # skip the post-install audit
#
# After installing plugins the script runs a keybinding self-check
# (--no-selfcheck to skip): it sources the conf in a throwaway, isolated tmux
# server and asserts that each custom/plugin key resolves to its intended
# command and that no terminal-equivalent control key (C-m/C-i/C-h/C-[) is
# bound. Plugins bind their default keys when TPM loads them (last-bind-wins),
# so a regression here means a plugin silently clobbered a custom bind. The
# check exits non-zero if so. See docs/TMUX.md "Conflicts & how this conf
# avoids them".
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
SELFCHECK=1
for arg in "$@"; do
  case "${arg}" in
    --no-sessions)  MAKE_SESSIONS=0 ;;
    --no-plugins)   MAKE_PLUGINS=0 ;;
    --no-selfcheck) SELFCHECK=0 ;;
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
# TPM's bin/install_plugins needs TMUX_PLUGIN_MANAGER_PATH set AND a tmux
# server that has sourced the conf (so the @plugin list is registered).
# Bootstrap a throwaway server/session for that, then install.
if [ "${MAKE_PLUGINS}" -eq 1 ]; then
  log "installing tmux plugins via TPM"
  export TMUX_PLUGIN_MANAGER_PATH="${HOME}/.tmux/plugins/"
  tmux start-server 2>/dev/null || true
  if ! tmux has-session -t __tpm_bootstrap 2>/dev/null; then
    tmux new-session -d -s __tpm_bootstrap 2>/dev/null || true
  fi
  tmux source-file "${HOME}/.tmux.conf" 2>/dev/null || true
  "${TPM_DIR}/bin/install_plugins" || log "plugin install reported non-zero (often benign)"
  tmux kill-session -t __tpm_bootstrap 2>/dev/null || true
fi

# 3b. keybinding self-check (clean-room audit)
# Source the canonical conf in an ISOLATED server (-L socket) started with
# -f /dev/null so it does NOT auto-source ~/.tmux.conf and contaminate the
# test. Then assert intent == live for every custom/plugin key and that no
# terminal-equivalent control key is bound. Fails loudly on any clobber.
tmux_selfcheck() {
  local sock="__cortex_selfcheck" rc=0 g
  g() { timeout 8 tmux -L "$sock" list-keys -T prefix "$1" 2>/dev/null; }
  timeout 8 tmux -L "$sock" kill-server 2>/dev/null || true
  timeout 8 tmux -L "$sock" -f /dev/null new-session -d -s c 2>/dev/null || {
    log "self-check: could not start audit server — skipping"; return 0; }
  timeout 8 tmux -L "$sock" source-file "${TMUX_CONF_SRC}" 2>/dev/null || true
  sleep 5  # TPM loads plugins via run-shell -b; give them time to bind

  # intended owner (a substring that must appear in the live binding)
  # key<TAB>expected-substring
  local want
  want="$(printf '%s\n' \
    "S	resurrect/scripts/save.sh" \
    "R	resurrect/scripts/restore.sh" \
    "C-s	tmux-sidebar/scripts/toggle.sh" \
    "C-b	tmux-sidebar/scripts/toggle.sh" \
    "Tab	treemux/scripts/toggle.sh" \
    "C-y	treemux/scripts/toggle.sh" \
    "C-e	extrakto" \
    "C-Space	tmux-menus" \
    "M	named-snapshot/scripts/save-snapshot.sh" \
    "N	named-snapshot/scripts/restore-snapshot.sh" \
    "C-f	tmux-fzf/main.sh" \
    "C-t	choose-tree" \
    "r	source-file")"

  local key sub live
  while IFS=$'\t' read -r key sub; do
    [ -n "$key" ] || continue
    live="$(g "$key")"
    if ! printf '%s' "$live" | grep -qF "$sub"; then
      log "SELF-CHECK FAIL: prefix '$key' should map to '*${sub}*' but is: ${live:-<unbound>}"
      rc=1
    fi
  done <<EOF
$want
EOF

  # terminal-equivalent keys must be unbound (C-m=Enter, C-i=Tab, C-h=Bspace, C-[=Esc)
  local danger
  for danger in C-m C-i C-h 'C-['; do
    live="$(g "$danger")"
    if [ -n "$live" ]; then
      log "SELF-CHECK FAIL: terminal-equivalent key '$danger' is bound: $live"
      rc=1
    fi
  done

  timeout 8 tmux -L "$sock" kill-server 2>/dev/null || true
  if [ "$rc" -eq 0 ]; then
    log "self-check passed: all custom/plugin keys intact; no terminal-equivalent binds"
  else
    log "self-check FAILED — a plugin clobbered a custom bind or a danger key is bound"
  fi
  return "$rc"
}

if [ "${MAKE_PLUGINS}" -eq 1 ] && [ "${SELFCHECK}" -eq 1 ]; then
  log "running keybinding self-check"
  tmux_selfcheck || exit 1
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
