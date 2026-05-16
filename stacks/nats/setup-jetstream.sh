#!/usr/bin/env bash
set -euo pipefail

NATS_URL="${NATS_URL:-nats://127.0.0.1:4222}"
STREAM="${CORTEX_STREAM:-CORTEX}"
CONSUMER="${CORTEX_CONSUMER:-cortex-consumer}"

if ! command -v nats >/dev/null 2>&1; then
  echo "nats CLI required" >&2
  exit 1
fi

nats --server "$NATS_URL" stream info "$STREAM" >/dev/null 2>&1 || \
  nats --server "$NATS_URL" stream add "$STREAM" \
    --subjects "cortex.>" \
    --storage file \
    --retention limits \
    --discard old \
    --max-age 30d \
    --max-msgs -1 \
    --max-bytes -1 \
    --replicas 1 \
    --dupe-window 2m \
    --no-allow-rollup \
    --no-deny-delete \
    --no-deny-purge

nats --server "$NATS_URL" consumer info "$STREAM" "$CONSUMER" >/dev/null 2>&1 || \
  nats --server "$NATS_URL" consumer add "$STREAM" "$CONSUMER" \
    --filter "cortex.>" \
    --ack explicit \
    --deliver all \
    --pull \
    --max-deliver 5 \
    --wait 30s

echo "JetStream ready: stream=$STREAM consumer=$CONSUMER"
