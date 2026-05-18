#!/usr/bin/env bash
# Hourly Sigstore Rekor anchor for the CortexOS audit hash chain.
#
# Designed to run from cron / systemd timer on the VPS hosting the
# dashboard Postgres. Single call to the `cortex-audit` CLI (workspace
# bin); the CLI itself verifies the chain before uploading and refuses
# to anchor a broken chain.
#
# Required env (sourced from /opt/cortexos/.secrets/dashboard.env by the
# wrapper unit):
#   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
#   CORTEX_REKOR_URL (optional, defaults to https://rekor.sigstore.dev)
#
# Exit codes (propagated from the CLI):
#   0  anchored OR no rows pending
#   1  unexpected internal error
#   2  chain broken — refuse to anchor; alert is the operator's job
#   3  Rekor upload failure (transient — cron retries next hour)
set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
LOG_DIR="${LOG_DIR:-${CORTEX_ROOT}/logs}"
mkdir -p "$LOG_DIR"

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_FILE="${LOG_DIR}/audit-anchor-${STAMP}.log"

# Anchor the entire current backlog. The CLI computes the actual batch.
{
  echo "[$(date -u +%FT%TZ)] cortex-audit anchor start"
  if command -v cortex-audit >/dev/null 2>&1; then
    cortex-audit anchor
  else
    # Workspace-relative fallback when the bin isn't on PATH.
    node "${CORTEX_ROOT}/packages/cortex-audit/bin/cortex-audit.js" anchor
  fi
  echo "[$(date -u +%FT%TZ)] cortex-audit anchor end"
} | tee -a "$LOG_FILE"
