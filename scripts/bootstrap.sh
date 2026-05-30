#!/usr/bin/env bash
# bootstrap.sh — operator-laptop dispatcher for CortexOS installs.
#
# Source from the repo root on your laptop:
#
#   source scripts/bootstrap.sh
#   bootstrap_check_local_deps
#   bootstrap_ensure_operator_age_key
#   bootstrap_detect_remote_os
#   bootstrap_push_repo
#   bootstrap_run_remote 'cd "$CORTEX_ROOT" && bash prompts/...'
#   bootstrap_push_secrets
#
# All functions are idempotent. SSH access to $CORTEX_USER@$CORTEX_HOST
# must be configured (key-based auth recommended). The VPS receives the
# repository over `git archive | ssh tar -x`; no rsync is used.
#
# Flags (when invoked as `scripts/bootstrap.sh <subcommand>`):
#   --host <host>       overrides CORTEX_HOST
#   --user <user>       overrides CORTEX_USER
#   --root <path>       overrides CORTEX_ROOT (must end with /opt/cortexos)
#   --domain <domain>   overrides CORTEX_DOMAIN
#
# Subcommands match the public functions below (e.g. `check-local-deps`,
# `detect-remote-os`, `push-repo`, `run-remote <cmd>`, `push-secrets`).

set -eu

# Resolve our own dir so we can find sibling scripts regardless of cwd.
__bs_self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
__bs_repo_root="$(cd "${__bs_self_dir}/.." && pwd)"

__bs_log() {
  printf '[bootstrap] %s\n' "$*" >&2
}

# ---------------------------------------------------------------------------
# Sudo acquisition + keepalive
# ---------------------------------------------------------------------------
# Validates sudo on the operator laptop once at the start of a dispatch run
# and refreshes the sudo timestamp every 60s via a background keepalive loop.
# The password is NEVER written to a file or env var — we rely entirely on
# sudo's own credential cache (`sudo -v` to seed, `sudo -n true` to refresh).
ensure_sudo() {
  if ! sudo -v; then
    __bs_die "sudo required on the operator laptop"
    return 1
  fi
  # Refresh cached creds every 60s; exit when parent dies.
  ( while true; do
      sudo -n true 2>/dev/null || exit
      sleep 60
      kill -0 "$$" 2>/dev/null || exit
    done ) &
  SUDO_KEEPALIVE_PID=$!
  trap 'kill "$SUDO_KEEPALIVE_PID" 2>/dev/null || true' EXIT INT TERM
  __bs_log "sudo cached; keepalive pid=$SUDO_KEEPALIVE_PID"
}

__bs_die() {
  printf '[bootstrap] ERROR: %s\n' "$*" >&2
  return 1
}

__bs_ssh_target() {
  printf '%s@%s' "${CORTEX_USER}" "${CORTEX_HOST}"
}

__bs_ssh() {
  ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "$(__bs_ssh_target)" "$@"
}

__bs_scp() {
  scp -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$@"
}

# ---------------------------------------------------------------------------
# Public functions
# ---------------------------------------------------------------------------

bootstrap_check_local_deps() {
  local missing=0
  for bin in ssh scp git sops age age-keygen tar; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      __bs_log "missing local dependency: $bin"
      missing=1
    fi
  done

  for var in CORTEX_HOST CORTEX_USER CORTEX_ROOT CORTEX_DOMAIN; do
    if [ -z "${!var:-}" ]; then
      __bs_log "missing env var: $var"
      missing=1
    fi
  done

  if [ "${CORTEX_ROOT:-}" != "/opt/cortexos" ]; then
    __bs_log "CORTEX_ROOT must be /opt/cortexos (got '${CORTEX_ROOT:-}')"
    missing=1
  fi

  if [ "$missing" -ne 0 ]; then
    __bs_die "local preflight failed"
    return 1
  fi

  if ! __bs_ssh true >/dev/null 2>&1; then
    __bs_die "ssh ${CORTEX_USER}@${CORTEX_HOST} failed; configure key auth first"
    return 1
  fi

  __bs_log "local deps OK; ssh to ${CORTEX_USER}@${CORTEX_HOST} OK"
}

bootstrap_ensure_operator_age_key() {
  local key_file="${SOPS_AGE_KEY_FILE:-${HOME}/.config/sops/age/keys.txt}"
  mkdir -p "$(dirname "$key_file")"
  chmod 700 "$(dirname "$key_file")" 2>/dev/null || true

  if [ ! -s "$key_file" ]; then
    __bs_log "generating new operator age key at $key_file"
    age-keygen -o "$key_file" >/dev/null
    chmod 600 "$key_file"
  else
    __bs_log "operator age key already present at $key_file"
  fi

  local pub
  pub="$(age-keygen -y "$key_file")"
  printf '%s\n' "$pub"

  if ! grep -Fq "$pub" "${__bs_repo_root}/.sops.yaml" 2>/dev/null; then
    __bs_log "WARN: operator pubkey not present in .sops.yaml"
    __bs_log "      add it under creation_rules.age and run: sops updatekeys templates/.secrets/*.enc.yaml"
  fi
}

bootstrap_detect_remote_os() {
  local line family version
  line="$(__bs_ssh 'bash -s' < "${__bs_repo_root}/scripts/os-detect.sh")"
  family="$(printf '%s' "$line" | awk '{print $1}')"
  version="$(printf '%s' "$line" | awk '{print $2}')"

  case "$family" in
    ubuntu|debian) : ;;
    *)
      __bs_die "unsupported remote OS family: '$family' (raw: $line)"
      return 1
      ;;
  esac

  export CORTEX_OS_FAMILY="$family"
  export CORTEX_OS_VERSION="$version"
  __bs_log "remote OS: family=$family version=$version"
}

bootstrap_push_repo() {
  local target="${CORTEX_ROOT}"
  __bs_log "ensuring ${target} exists on remote, owned by ${CORTEX_USER}"
  __bs_ssh "sudo install -d -m 0755 -o '${CORTEX_USER}' -g '${CORTEX_USER}' '${target}'"

  __bs_log "materializing repo on remote via git archive | tar -x"
  ( cd "${__bs_repo_root}" \
      && git archive --format=tar HEAD ) \
    | __bs_ssh "tar -x -C '${target}'"

  __bs_ssh "test -f '${target}/scripts/pkg.sh' && test -f '${target}/scripts/os-detect.sh'" \
    || __bs_die "remote repo materialization failed (pkg.sh or os-detect.sh missing)"

  __bs_log "remote repo populated at ${target}"
}

bootstrap_run_remote() {
  if [ "$#" -lt 1 ]; then
    __bs_die "bootstrap_run_remote requires a command string"
    return 1
  fi
  local cmd="$1"
  __bs_ssh "
    set -eu
    export CORTEX_ROOT='${CORTEX_ROOT}'
    export CORTEX_USER='${CORTEX_USER}'
    export CORTEX_DOMAIN='${CORTEX_DOMAIN}'
    export CORTEX_OS_FAMILY='${CORTEX_OS_FAMILY:-}'
    export CORTEX_OS_VERSION='${CORTEX_OS_VERSION:-}'
    ${cmd}
  "
}

bootstrap_push_secrets() {
  local key_file="${SOPS_AGE_KEY_FILE:-${HOME}/.config/sops/age/keys.txt}"
  [ -s "$key_file" ] || { __bs_die "no operator age key at $key_file"; return 1; }

  local tmp
  tmp="$(mktemp -d -t cortexos-secrets.XXXXXX)"
  trap "rm -rf '$tmp'" RETURN

  __bs_log "decrypting secrets locally into $tmp"
  (
    cd "${__bs_repo_root}"
    SOPS_AGE_KEY_FILE="$key_file" \
    SECRETS_DEST_DIR="$tmp" \
      bash scripts/secrets-decrypt.sh
  )

  __bs_ssh "sudo install -d -m 0700 -o '${CORTEX_USER}' -g '${CORTEX_USER}' '${CORTEX_ROOT}/.secrets'"

  local f base
  for f in "$tmp"/*.env; do
    [ -e "$f" ] || continue
    base="$(basename "$f")"
    __bs_log "scp ${base} -> ${CORTEX_ROOT}/.secrets/"
    __bs_scp "$f" "$(__bs_ssh_target):/tmp/${base}.bootstrap"
    __bs_ssh "
      set -eu
      sudo install -m 0600 -o '${CORTEX_USER}' -g '${CORTEX_USER}' \
        '/tmp/${base}.bootstrap' '${CORTEX_ROOT}/.secrets/${base}'
      shred -u '/tmp/${base}.bootstrap' 2>/dev/null || rm -f '/tmp/${base}.bootstrap'
    "
  done

  __bs_log "secrets push complete"
}

# ---------------------------------------------------------------------------
# CLI dispatch (only when executed directly)
# ---------------------------------------------------------------------------

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  while [ $# -gt 0 ]; do
    case "$1" in
      --host)   CORTEX_HOST="$2"; shift 2 ;;
      --user)   CORTEX_USER="$2"; shift 2 ;;
      --root)   CORTEX_ROOT="$2"; shift 2 ;;
      --domain) CORTEX_DOMAIN="$2"; shift 2 ;;
      --)       shift; break ;;
      -*)       __bs_die "unknown flag: $1"; exit 1 ;;
      *)        break ;;
    esac
  done
  export CORTEX_HOST CORTEX_USER CORTEX_ROOT CORTEX_DOMAIN

  sub="${1:-}"
  shift || true

  # Acquire sudo once for any subcommand that may need privileged ops on
  # the laptop (push-secrets writes to /tmp shred targets; future hooks).
  # `help`/empty are skipped to keep `--help` a no-op.
  case "$sub" in
    "" | help | -h | --help) : ;;
    *) ensure_sudo ;;
  esac

  case "$sub" in
    check-local-deps)        bootstrap_check_local_deps "$@" ;;
    ensure-operator-age-key) bootstrap_ensure_operator_age_key "$@" ;;
    detect-remote-os)        bootstrap_detect_remote_os "$@" ;;
    push-repo)               bootstrap_push_repo "$@" ;;
    run-remote)              bootstrap_run_remote "$@" ;;
    push-secrets)            bootstrap_push_secrets "$@" ;;
    "" | help | -h | --help)
      cat <<'USAGE'
Usage: scripts/bootstrap.sh [--host H] [--user U] [--root R] [--domain D] <subcommand> [args]

Subcommands:
  check-local-deps          Verify laptop has ssh/scp/git/sops/age and env vars set.
  ensure-operator-age-key   Create ~/.config/sops/age/keys.txt if missing; print pubkey.
  detect-remote-os          ssh-run scripts/os-detect.sh on the VPS; export CORTEX_OS_FAMILY.
  push-repo                 git archive | ssh tar -x — materialize repo at $CORTEX_ROOT.
  run-remote <cmd>          Run <cmd> on the VPS with CortexOS env exported.
  push-secrets              Decrypt locally with operator age key, scp .env to /opt/cortexos/.secrets/.
USAGE
      ;;
    *)
      __bs_die "unknown subcommand: $sub"; exit 1 ;;
  esac
fi
