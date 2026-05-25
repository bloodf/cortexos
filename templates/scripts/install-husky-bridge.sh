#!/usr/bin/env bash
# install-husky-bridge.sh — install husky-as-CI hooks publishing to NATS
#
# Usage:
#   install-husky-bridge.sh <repo-path> <repo-slug>
#
# repo-slug becomes the subject component: cortex.ci.<slug>.{passed,failed}
# NATS broker: nats://127.0.0.1:4222 (cortex VPS, host network)
set -euo pipefail

REPO="${1:?repo path required}"
SLUG="${2:?repo slug required}"
NATS_URL="${NATS_URL:-nats://127.0.0.1:4222}"

cd "$REPO"
test -d .git || { echo "not a git repo: $REPO" >&2; exit 1; }

mkdir -p .husky

cat > .husky/_pub-nats <<EOF
#!/usr/bin/env bash
# auto-generated: cortex husky-as-CI bridge
set -euo pipefail
RESULT="\${1:-passed}"
SUBJECT="cortex.ci.${SLUG}.\${RESULT}"
SHA="\$(git rev-parse HEAD 2>/dev/null || echo unknown)"
TS="\$(date -u +%FT%TZ)"
PAYLOAD="{\"repo\":\"${SLUG}\",\"sha\":\"\$SHA\",\"result\":\"\$RESULT\",\"ts\":\"\$TS\"}"
if command -v nats >/dev/null 2>&1; then
  nats --server="${NATS_URL}" pub "\$SUBJECT" "\$PAYLOAD" >/dev/null 2>&1 || true
fi
EOF
chmod +x .husky/_pub-nats

cat > .husky/pre-push <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
DIR="$(dirname "$0")"
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  if jq -e '.scripts.test' package.json >/dev/null 2>&1; then
    npm test --silent || { "$DIR/_pub-nats" failed; exit 1; }
  fi
  if jq -e '.scripts.build' package.json >/dev/null 2>&1; then
    npm run build --silent || { "$DIR/_pub-nats" failed; exit 1; }
  fi
fi
"$DIR/_pub-nats" passed
EOF
chmod +x .husky/pre-push

cat > .husky/pre-commit <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  if jq -e '.scripts.lint' package.json >/dev/null 2>&1; then
    npm run lint --silent || exit 1
  fi
fi
EOF
chmod +x .husky/pre-commit

git config core.hooksPath .husky

echo "installed husky-as-CI bridge: $REPO (slug=$SLUG, nats=$NATS_URL)"
