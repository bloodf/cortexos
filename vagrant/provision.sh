#!/usr/bin/env bash
# vagrant/provision.sh — base provisioning for CortexOS rehearsal VMs.
#
# Idempotent. Re-runnable. Installs the minimum tools the operator prompts
# expect to exist before pkg.sh / os-detect.sh take over.

set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"

log() { printf '[provision] %s\n' "$*"; }

# Detect family without depending on the repo (script may not be synced yet
# on the very first boot of a fresh box).
detect_family() {
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    case "${ID:-}" in
      ubuntu|debian) echo ubuntu ;;
      fedora)        echo fedora ;;
      rhel|rocky|almalinux|centos) echo rhel ;;
      *)             echo unsupported ;;
    esac
  else
    echo unsupported
  fi
}

FAMILY="$(detect_family)"
log "detected family: ${FAMILY}"

case "${FAMILY}" in
  ubuntu)
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y git curl jq make rsync ufw ca-certificates
    ;;
  fedora)
    dnf -y install git curl jq make rsync firewalld ca-certificates
    systemctl enable --now firewalld || true
    ;;
  rhel)
    # P6: stub.
    dnf -y install git curl jq make rsync firewalld ca-certificates || true
    systemctl enable --now firewalld || true
    ;;
  *)
    log "unsupported family; skipping package install"
    ;;
esac

# Ownership of synced folder. Vagrant user exists on all generic/* boxes.
if id vagrant >/dev/null 2>&1; then
  if [ -d "${CORTEX_ROOT}" ]; then
    chown -R vagrant:vagrant "${CORTEX_ROOT}" || true
  fi
fi

# Log evidence: invoke the repo's os-detect.sh if synced.
if [ -x "${CORTEX_ROOT}/scripts/os-detect.sh" ]; then
  log "os-detect.sh says: $("${CORTEX_ROOT}/scripts/os-detect.sh")"
else
  log "os-detect.sh not present yet at ${CORTEX_ROOT}/scripts/os-detect.sh"
fi

log "provision complete"
