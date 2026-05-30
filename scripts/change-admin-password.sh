#!/bin/bash
# Reset an admin password directly in PostgreSQL.
# Run on the VPS inside ${CORTEX_DASHBOARD_DIR} (default /opt/cortexos/dashboard).
#
# Usage:
#   sudo ./scripts/change-admin-password.sh <new-password> [username]
#
# Loads DB credentials from ${CORTEX_DASHBOARD_ENV_FILE} (default
# /opt/cortexos/secrets/dashboard.env). Uses bundled bcryptjs from the
# deployed node_modules. Username defaults to "admin".
set -euo pipefail

NEW_PW="${1:?Usage: $0 <new-password> [username]}"
USERNAME="${2:-admin}"
ENV_FILE="${CORTEX_DASHBOARD_ENV_FILE:-/opt/cortexos/secrets/dashboard.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ${#NEW_PW} -lt 8 ]]; then
  echo "Password must be at least 8 chars" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${DB_PASSWORD:?DB_PASSWORD missing from env file}"
: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=5432}"
: "${DB_USER:=dashboard}"
: "${DB_NAME:=cortex_dashboard}"

HASH=$(node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" "$NEW_PW")

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "INSERT INTO admin_users (username, password_hash, is_admin) VALUES ('${USERNAME}', '${HASH}', TRUE) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;"

echo "Password updated for user '${USERNAME}'"
