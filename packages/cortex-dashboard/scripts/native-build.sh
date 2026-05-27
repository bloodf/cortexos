#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo_root="$(cd "$(dirname "$0")/../../.." && pwd)"
if [ -f "$repo_root/scripts/pkg.sh" ]; then
  # authenticate-pam compiles a native PAM addon during install/rebuild.
  # Debian/Ubuntu hosts need pam_appl.h before pnpm touches node_modules.
  # shellcheck source=/dev/null
  . "$repo_root/scripts/pkg.sh"
  pkg_install libpam0g-dev
else
  sudo apt-get update
  sudo apt-get install -y --no-install-recommends libpam0g-dev
fi
pnpm install --frozen-lockfile
pnpm run build
install -d .next/standalone/.next
cp -a .next/static .next/standalone/.next/static
cp -a public .next/standalone/public 2>/dev/null || true
