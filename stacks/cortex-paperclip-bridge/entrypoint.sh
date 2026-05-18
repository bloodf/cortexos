#!/bin/sh
set -eu
# Start worker in background; if it dies the container keeps running until server exits.
node worker.js &
WORKER_PID=$!
trap 'kill -TERM "$WORKER_PID" 2>/dev/null || true' TERM INT
exec node server.js
