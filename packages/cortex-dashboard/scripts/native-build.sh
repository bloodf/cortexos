#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm install --frozen-lockfile
pnpm run build
install -d .next/standalone/.next
cp -a .next/static .next/standalone/.next/static
cp -a public .next/standalone/public 2>/dev/null || true
