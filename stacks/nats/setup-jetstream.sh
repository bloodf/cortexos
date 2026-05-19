#!/usr/bin/env bash
set -euo pipefail

NATS_URL="${NATS_URL:-nats://127.0.0.1:4222}"

if ! command -v nats >/dev/null 2>&1; then
  echo "nats CLI not found; install from https://github.com/nats-io/natscli" >&2
  exit 1
fi

ensure_stream() {
  local name="$1" subjects="$2" retention="$3" max_age="${4:-}"
  if nats --server "$NATS_URL" stream info "$name" >/dev/null 2>&1; then
    return
  fi
  args=(--server "$NATS_URL" stream add "$name" --subjects "$subjects" --storage file --retention "$retention" --discard old --replicas 1 --dupe-window 2m --no-allow-rollup --no-deny-delete --no-deny-purge)
  if [ -n "$max_age" ]; then args+=(--max-age "$max_age"); fi
  nats "${args[@]}"
}

ensure_stream CORTEX_PAPERCLIP_WORK 'cortex.paperclip.work.>' workqueue 24h
ensure_stream CORTEX_PAPERCLIP_OPS 'cortex.paperclip.status.>,cortex.paperclip.approval.>,cortex.alerts.>,cortex.signals.>' limits
ensure_stream CORTEX_DLQ 'cortex.dlq.>' limits 7d
ensure_stream CORTEX_AUDIT 'cortex.audit.>' limits 30d
ensure_stream CORTEX 'cortex.factory.>,openclaw.>' limits 30d

nats --server "$NATS_URL" kv info cortex_approvals_seen >/dev/null 2>&1 || \
  nats --server "$NATS_URL" kv add cortex_approvals_seen --ttl 24h --replicas 1

echo "JetStream ready: CORTEX_PAPERCLIP_WORK CORTEX_PAPERCLIP_OPS CORTEX_DLQ CORTEX_AUDIT CORTEX; kv=cortex_approvals_seen"
