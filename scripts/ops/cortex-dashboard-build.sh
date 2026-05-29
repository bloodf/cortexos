#!/usr/bin/env bash
# cortex-dashboard-build.sh — build the dashboard natively on the host for the
# systemd runtime (cortex-dashboard.service). Mirrors the former Dockerfile
# builder stage exactly: per-package npm install, replace the @cortexos/audit
# workspace symlink with a real directory, next build, esbuild the custom
# server, then generate the Turbopack external-module + pg shims so
# `node server.js` resolves cleanly.
#
# Produces (in packages/cortex-dashboard/): server.js + .next + node_modules,
# which cortex-dashboard.service runs as `node server.js`.
#
# Idempotent. Run as the repo owner (cortexos). Usage: cortex-dashboard-build.sh
set -euo pipefail

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
AUDIT="${CORTEX_ROOT}/packages/cortex-audit"
DASH="${CORTEX_ROOT}/packages/cortex-dashboard"
export NEXT_TELEMETRY_DISABLED=1

log() { printf '[dashboard-build] %s\n' "$*"; }

command -v node >/dev/null || { echo "node not installed" >&2; exit 1; }
command -v npm  >/dev/null || { echo "npm not installed" >&2; exit 1; }
[ -d "$DASH" ] || { echo "missing $DASH" >&2; exit 1; }

log "installing @cortexos/audit deps"
( cd "$AUDIT" && npm install --no-audit --no-fund )

log "installing dashboard deps"
( cd "$DASH" && npm install --no-audit --no-fund )

# npm leaves @cortexos/audit as a file: symlink; Turbopack resolves a real dir
# more reliably. Replace the link with a real copy.
log "materializing @cortexos/audit as a real directory"
rm -rf "${DASH}/node_modules/@cortexos/audit"
mkdir -p "${DASH}/node_modules/@cortexos/audit"
cp -a "${AUDIT}/." "${DASH}/node_modules/@cortexos/audit/"

cd "$DASH"
log "next build"
npm run build:next

log "bundling custom server (esbuild server.ts -> server.js)"
npx esbuild server.ts \
  --bundle --platform=node --target=node22 --format=cjs --packages=external \
  --outfile=server.js

# Turbopack externalizes some modules as <name>-<hash>; generate generic shims
# so the CJS server can require them at runtime.
log "generating external-module shims"
node - <<'EOF'
const fs = require('fs');
const path = require('path');
const root = process.cwd();
const nextDir = path.join(root, '.next');
const aliases = new Map();
const aliasRe = /["']((?:@[^/"']+\/)?[^"'\/]+)-([a-f0-9]{8,})["']/g;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) {
      const text = fs.readFileSync(full, 'utf8');
      for (const m of text.matchAll(aliasRe)) {
        const fullAlias = m[1];
        const base = fullAlias.replace(/-[a-f0-9]{8,}$/, '');
        if (!aliases.has(fullAlias)) aliases.set(fullAlias, base);
      }
    }
  }
}
walk(nextDir);
for (const [aliasName, base] of aliases.entries()) {
  const dir = path.join(root, 'node_modules', aliasName);
  const target = base === 'pg' ? 'pg/lib/index.js' : base;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: aliasName, main: 'index.js' }, null, 2));
  fs.writeFileSync(path.join(dir, 'index.js'), `module.exports = require(${JSON.stringify(target)});\n`);
}
console.log(`created ${aliases.size} external-module shim(s)`);
EOF

# pg resolves via its lib entry under the CJS bundle.
log "pg shim"
mkdir -p "${DASH}/node_modules/pg"
printf '%s\n' "module.exports = require('./lib/index.js');" > "${DASH}/node_modules/pg/index.js"

log "build complete: ${DASH}/server.js"
