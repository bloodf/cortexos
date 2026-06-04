#!/usr/bin/env bash
# cortex-render-units.sh — render a templates/systemd/*.service template
# into the live /etc/systemd/system/ tree, substituting {CORTEX_ROOT}
# and {CORTEX_SECRETS_DIR} placeholders, then daemon-reload.
#
# Usage:   sudo bash scripts/ops/cortex-render-units.sh <unit-name.service>
# Example: sudo bash scripts/ops/cortex-render-units.sh cortex-dashboard.service
#
# The template is expected to live at:
#   templates/systemd/<unit-name>.service
# (relative to the repo root, which we discover from this script's path).
#
# Re-runnable. Idempotent. Refuses to render a unit whose template is
# missing or whose name doesn't end in `.service`.

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: must be run as root (sudo bash $0 ...)" >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: sudo bash $0 <unit-name.service>" >&2
  exit 2
fi

UNIT_NAME="$1"

# Discover the repo root from this script's path. This script lives
# at <repo>/scripts/ops/cortex-render-units.sh, so the repo root is
# two directories up.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CORTEX_ROOT="${CORTEX_ROOT:-$REPO_ROOT}"
CORTEX_SECRETS_DIR="${CORTEX_SECRETS_DIR:-/opt/cortexos/.secrets}"

TEMPLATE="$REPO_ROOT/templates/systemd/$UNIT_NAME"
DEST="/etc/systemd/system/$UNIT_NAME"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "ERROR: template not found: $TEMPLATE" >&2
  exit 3
fi

# Refuse to render anything that isn't a *.service. Misdirected
# template names are an easy way to corrupt the system.
if [[ "$UNIT_NAME" != *.service ]]; then
  echo "ERROR: unit name must end in .service (got: $UNIT_NAME)" >&2
  exit 4
fi

echo "rendering $TEMPLATE -> $DEST"
echo "  CORTEX_ROOT=$CORTEX_ROOT"
echo "  CORTEX_SECRETS_DIR=$CORTEX_SECRETS_DIR"

sed \
  -e "s|{CORTEX_ROOT}|$CORTEX_ROOT|g" \
  -e "s|{CORTEX_SECRETS_DIR}|$CORTEX_SECRETS_DIR|g" \
  "$TEMPLATE" > "$DEST"

chmod 0644 "$DEST"

echo "running daemon-reload"
systemctl daemon-reload

echo "done. enable with:  systemctl enable --now $UNIT_NAME"
