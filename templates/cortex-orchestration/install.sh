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

# Resolve repo root so we can source pkg.sh regardless of where install.sh was launched from.
__install_self="$(cd "$(dirname "$0")" && pwd)"
__repo_root="$(cd "${__install_self}/../.." && pwd)"
if [ -f "${__repo_root}/scripts/pkg.sh" ]; then
  # shellcheck source=/dev/null
  source "${__repo_root}/scripts/pkg.sh"
else
  echo "[install] WARN: scripts/pkg.sh not found at ${__repo_root}; falling back to apt-get" >&2
  pkg_install() { sudo apt-get install -y "$@"; }
  pkg_family()  { echo ubuntu; }
fi

CORTEX_HOME="/opt/cortex"
NATS_CLI_VERSION="0.1.5"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Supply-chain gate --------------------------------------------------------
# If CORTEX_RELEASE_ARTIFACT is set, treat it as a signed release tarball and
# verify it via scripts/verify-artifact.sh before any provisioning runs.
# Skip with CORTEX_SKIP_SUPPLY_CHAIN=1 only for local development on uncommitted
# trees — never in production.
if [ -n "${CORTEX_RELEASE_ARTIFACT:-}" ] && [ "${CORTEX_SKIP_SUPPLY_CHAIN:-0}" != "1" ]; then
  __verify="${__repo_root}/scripts/verify-artifact.sh"
  if [ ! -x "$__verify" ]; then
    echo "[install] FAIL: scripts/verify-artifact.sh missing or not executable at $__verify" >&2
    echo "[install] FAIL: cannot enforce supply-chain gate. Aborting." >&2
    exit 2
  fi
  echo "[install] verifying release artifact: $CORTEX_RELEASE_ARTIFACT"
  if [ -n "${CORTEX_RELEASE_REF:-}" ]; then
    "$__verify" "$CORTEX_RELEASE_ARTIFACT" --ref "$CORTEX_RELEASE_REF" \
      || { echo "[install] FAIL: supply-chain verification failed" >&2; exit 2; }
  else
    "$__verify" "$CORTEX_RELEASE_ARTIFACT" \
      || { echo "[install] FAIL: supply-chain verification failed" >&2; exit 2; }
  fi
  echo "[install] supply-chain gate: PASS"
elif [ "${CORTEX_SKIP_SUPPLY_CHAIN:-0}" = "1" ]; then
  echo "[install] WARN: CORTEX_SKIP_SUPPLY_CHAIN=1 — bypassing supply-chain verification (dev only)" >&2
else
  echo "[install] NOTE: CORTEX_RELEASE_ARTIFACT not set — installing from working tree (dev mode)."
  echo "[install] NOTE: production installs MUST set CORTEX_RELEASE_ARTIFACT to a signed tarball. See docs/SUPPLY-CHAIN.md."
fi

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
if ! python3 -c "import yaml" 2>/dev/null; then
  echo "[install] installing PyYAML for $(pkg_family)"
  pkg_install python3-yaml
fi

# Wait for NATS, then init streams
echo "[install] waiting for NATS on 127.0.0.1:4222 ..."
for i in $(seq 1 30); do
  if nats --server=nats://127.0.0.1:4222 server check >/dev/null 2>&1; then echo "[install] NATS ready"; break; fi
  sleep 1
done

"$CORTEX_HOME/bin/cortex-bus-init"
echo "[install] DONE"
