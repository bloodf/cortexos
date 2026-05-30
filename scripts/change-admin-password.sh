#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  -h|--help)
    cat <<'USAGE'
Usage: change-admin-password.sh <username> [new-password]

Resets the password for an existing admin user in the dashboard DB.
If new-password is omitted, the script prompts.

Env: reads $CORTEX_ROOT/secrets/dashboard.env when present, else expects
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in the environment.
USAGE
    exit 0
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${CORTEX_ROOT:-/opt/cortex}/secrets/dashboard.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cortex_dashboard}"
DB_USER="${DB_USER:-dashboard}"
DB_PASSWORD="${DB_PASSWORD:-}"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "Error: DB_PASSWORD not set. Provide dashboard.env or set env vars." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <new-password> [username]"
  echo "Default username: admin"
  exit 1
fi

NEW_PASSWORD="$1"
USERNAME="${2:-admin}"

if [[ "${#NEW_PASSWORD}" -lt 6 ]]; then
  echo "Error: Password must be at least 6 characters." >&2
  exit 1
fi

# Hash password with bcryptjs via Node.js (already in dashboard deps)
HASH=$(node -e '
  const bcrypt = require("bcryptjs");
  console.log(bcrypt.hashSync(process.argv[1], 12));
' "$NEW_PASSWORD")

PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<EOF
UPDATE admin_users SET password_hash = '${HASH}' WHERE username = '${USERNAME}';
EOF

echo "Password updated for user: $USERNAME"
