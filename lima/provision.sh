#!/usr/bin/env bash
# CortexOS Lima VM provisioner.
# Usage: provision.sh <family>   where family is "ubuntu" or "debian".
set -eu

FAMILY="${1:-}"
if [ -z "$FAMILY" ]; then
  echo "Usage: $0 <ubuntu|debian>" >&2
  exit 2
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  jq

# Install Docker CE via official convenience script.
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
fi

# Add the default Lima user to docker group.
# Lima default user is "ubuntu" on Ubuntu and the invoking $LIMA_USER otherwise.
DEFAULT_USER="${LIMA_USER:-}"
if [ -z "$DEFAULT_USER" ]; then
  if id ubuntu >/dev/null 2>&1; then
    DEFAULT_USER="ubuntu"
  else
    DEFAULT_USER="$(getent passwd 1000 | cut -d: -f1 || true)"
  fi
fi
if [ -n "$DEFAULT_USER" ] && id "$DEFAULT_USER" >/dev/null 2>&1; then
  usermod -aG docker "$DEFAULT_USER" || true
fi

# Symlink mounted source tree to canonical CortexOS root.
if [ ! -e /opt/cortexos ]; then
  ln -s /opt/cortexos-src /opt/cortexos
fi

DISTRO_NAME="unknown"
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  DISTRO_NAME="${PRETTY_NAME:-unknown}"
fi

echo "Lima provision complete: family=${FAMILY}, distro=${DISTRO_NAME}"
