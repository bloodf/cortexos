#!/usr/bin/env bash
# install.sh — provision cortex orchestration on the VPS
# Run as configured CortexOS user on cortex. Idempotent.
#
# Installs:
#   /opt/cortex/{bin,logs,runs,state,workflows}/
#   /opt/cortex/bin/{cortex-bus,cortex-flux,cortex-bus-init}
#   /usr/local/bin/nats (NATS CLI)
#   systemd: cortex-bus-bootstrap.service (one-shot, creates streams)
#
# Requires:
#   - docker, jq, python3, python3-yaml installed
#   - NATS server running (started by docker-compose.infra.yml)
set -u
set -o pipefail

CORTEX_HOME="/opt/cortex"
NATS_CLI_VERSION="0.1.5"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[install] target=$CORTEX_HOME"
sudo mkdir -p "$CORTEX_HOME/"{bin,logs,runs,state,workflows}
sudo chown -R ${CORTEX_USER}:${CORTEX_USER} "$CORTEX_HOME"

for f in cortex-bus cortex-flux cortex-bus-init; do
  install -m 0755 "$SRC_DIR/bin/$f" "$CORTEX_HOME/bin/$f"
  echo "[install] $CORTEX_HOME/bin/$f"
done

# NATS CLI
if ! command -v nats >/dev/null 2>&1; then
  echo "[install] fetching nats CLI v$NATS_CLI_VERSION"
  tmp="$(mktemp -d)"
  curl -fsSL "https://github.com/nats-io/natscli/releases/download/v${NATS_CLI_VERSION}/nats-${NATS_CLI_VERSION}-linux-amd64.zip" -o "$tmp/nats.zip"
  ( cd "$tmp" && unzip -q nats.zip && sudo install -m 0755 "nats-${NATS_CLI_VERSION}-linux-amd64/nats" /usr/local/bin/nats )
  rm -rf "$tmp"
fi
nats --version

# python3-yaml check
python3 -c "import yaml" 2>/dev/null || { echo "[install] installing python3-yaml"; sudo apt-get install -y python3-yaml; }

# Wait for NATS, then init streams
echo "[install] waiting for NATS on 127.0.0.1:4222 ..."
for i in $(seq 1 30); do
  if nats --server=nats://127.0.0.1:4222 server check >/dev/null 2>&1; then echo "[install] NATS ready"; break; fi
  sleep 1
done

"$CORTEX_HOME/bin/cortex-bus-init"
echo "[install] DONE"
