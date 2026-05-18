#!/bin/sh
set -eu
# Start worker + alerts in background; server runs in foreground.
node worker.js &
WORKER_PID=$!
node alerts.js &
ALERTS_PID=$!
trap 'kill -TERM "$WORKER_PID" "$ALERTS_PID" 2>/dev/null || true' TERM INT
exec node server.js
