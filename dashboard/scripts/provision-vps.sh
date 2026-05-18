#!/bin/bash
# Fresh-VPS provisioner for the Cortex Dashboard host.
# Idempotent: safe to re-run. Installs Node 24 (via linuxbrew), PostgreSQL 17,
# creates the dashboard role + database, scaffolds /opt/cortexos directory tree,
# and seeds /opt/cortexos/secrets/dashboard.env from the template.
#
# Run as the SSH user with sudo (NOT as root directly — linuxbrew rejects root).
#
# Usage:
#   ./scripts/provision-vps.sh [--with-caddy]
#
# Env overrides:
#   CORTEX_ROOT             /opt/cortexos
#   CORTEX_DB_PASSWORD      auto-generated if unset
#   CORTEX_MASTER_KEY       auto-generated if unset
#   DASHBOARD_ORIGIN        defaults to http://$(hostname -I | awk '{print $1}'):3080
set -euo pipefail

# Source distro-agnostic pkg dispatcher. Repo root is two levels up from this script.
__prov_self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
__repo_root="$(cd "${__prov_self}/../.." && pwd)"
if [[ -f "${__repo_root}/scripts/pkg.sh" ]]; then
  # shellcheck source=/dev/null
  source "${__repo_root}/scripts/pkg.sh"
else
  echo "[provision] WARN: ${__repo_root}/scripts/pkg.sh not found; assuming Ubuntu" >&2
  pkg_install() { sudo apt-get install -y --no-install-recommends "$@"; }
  pkg_family()  { echo ubuntu; }
  firewall_open() { sudo ufw allow "$1/${2:-tcp}" || true; }
fi
echo "[provision] OS family: $(pkg_family) $(pkg_version 2>/dev/null || echo unknown)"

WITH_CADDY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-caddy) WITH_CADDY=1; shift ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [[ $EUID -eq 0 ]]; then
  echo "Run as a non-root user with sudo privileges (linuxbrew rejects root)." >&2
  exit 1
fi

CORTEX_ROOT="${CORTEX_ROOT:-/opt/cortexos}"
SECRETS_DIR="${CORTEX_ROOT}/secrets"
ENV_FILE="${SECRETS_DIR}/dashboard.env"
DASHBOARD_DIR="${CORTEX_ROOT}/dashboard"
BACKUPS_DIR="${CORTEX_ROOT}/backups/dashboard"
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
DASHBOARD_ORIGIN_DEFAULT="http://${LAN_IP:-127.0.0.1}:3080"

echo "=== [1/7] Refreshing package index ==="
case "$(pkg_family)" in
  ubuntu|debian) sudo apt-get update -y ;;
  *) echo "Unsupported OS family: $(pkg_family)" >&2; exit 3 ;;
esac

echo "=== [2/7] Installing baseline packages ==="
pkg_install \
  curl ca-certificates gnupg lsb-release build-essential \
  postgresql postgresql-contrib \
  rsync ufw git jq

echo "=== [3/7] Installing Node 24 via linuxbrew (idempotent) ==="
if [[ ! -x /home/linuxbrew/.linuxbrew/bin/brew ]]; then
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
export PATH="/home/linuxbrew/.linuxbrew/bin:${PATH}"
if ! command -v node >/dev/null || [[ "$(node -v 2>/dev/null | cut -c2- | cut -d. -f1)" != "24" ]]; then
  brew install node@24
  brew link --overwrite --force node@24
fi
NODE_BIN="$(brew --prefix node@24)/bin/node"
echo "Node: $(${NODE_BIN} -v)"

echo "=== [4/7] Ensuring PostgreSQL is running ==="
sudo systemctl enable --now postgresql

DB_NAME="cortex_dashboard"
DB_USER="dashboard"

if [[ -z "${CORTEX_DB_PASSWORD:-}" ]]; then
  if [[ -f "$ENV_FILE" ]] && sudo grep -q '^DB_PASSWORD=' "$ENV_FILE"; then
    CORTEX_DB_PASSWORD="$(sudo grep '^DB_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
  else
    CORTEX_DB_PASSWORD="$(openssl rand -hex 24)"
  fi
fi

echo "=== [5/7] Creating PostgreSQL role + database (idempotent) ==="
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${CORTEX_DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${CORTEX_DB_PASSWORD}';
  END IF;
END\$\$;
SQL
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

echo "=== [6/7] Scaffolding ${CORTEX_ROOT} layout ==="
sudo mkdir -p "${SECRETS_DIR}" "${DASHBOARD_DIR}" "${BACKUPS_DIR}" "${CORTEX_ROOT}/.secrets"
sudo chown root:root "${SECRETS_DIR}"
sudo chmod 0700 "${SECRETS_DIR}"
sudo chmod 0700 "${CORTEX_ROOT}/.secrets"
sudo chown -R "${USER}:${USER}" "${DASHBOARD_DIR}" "${BACKUPS_DIR}"

# SOPS decrypt of templates/.secrets/*.enc.yaml -> /opt/cortexos/.secrets/*.env
# Prereq: prompts/tools/12a-sops-bootstrap.md must have placed the host age key.
SOPS_AGE_KEY_FILE_DEFAULT="${CORTEX_ROOT}/.age/host.key"
SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-${SOPS_AGE_KEY_FILE_DEFAULT}}"
if [[ -f "${SOPS_AGE_KEY_FILE}" ]] && command -v sops >/dev/null 2>&1; then
  echo "  Decrypting templates/.secrets/*.enc.yaml -> ${CORTEX_ROOT}/.secrets/"
  sudo -E SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE}" \
    bash "${__repo_root}/scripts/secrets-decrypt.sh"
else
  echo "  WARN: ${SOPS_AGE_KEY_FILE} or sops missing — skipping decrypt."
  echo "        Run prompts/tools/12a-sops-bootstrap.md before starting services."
fi

if [[ ! -f "$ENV_FILE" ]]; then
  MASTER_KEY="${CORTEX_MASTER_KEY:-$(openssl rand -hex 32)}"
  TMP_ENV="$(mktemp)"
  cat > "$TMP_ENV" <<EOF
PORT=3080
NODE_ENV=production
HOSTNAME=0.0.0.0
DASHBOARD_ORIGIN=${DASHBOARD_ORIGIN:-$DASHBOARD_ORIGIN_DEFAULT}

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${CORTEX_DB_PASSWORD}

CORTEX_MASTER_KEY=${MASTER_KEY}
EOF
  sudo mv "$TMP_ENV" "$ENV_FILE"
  sudo chown root:root "$ENV_FILE"
  sudo chmod 0600 "$ENV_FILE"
  echo "  Wrote $ENV_FILE (root:0600)"
else
  echo "  $ENV_FILE already exists — leaving untouched"
fi

if [[ $WITH_CADDY -eq 1 ]]; then
  echo "=== Installing Caddy ($(pkg_family)) ==="
  if ! command -v caddy >/dev/null; then
    pkg_install debian-keyring debian-archive-keyring apt-transport-https
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
      | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
      | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    sudo apt-get update -y
    pkg_install caddy
  fi
  sudo systemctl enable --now caddy
  # Open HTTP/HTTPS in firewall (no-op on UFW if rule already exists).
  firewall_open 80  tcp
  firewall_open 443 tcp
fi

echo "=== [7/7] Provision complete ==="
echo "  Node binary    : ${NODE_BIN}"
echo "  Dashboard root : ${DASHBOARD_DIR}"
echo "  Env file       : ${ENV_FILE}"
echo "  Postgres       : ${DB_USER}@127.0.0.1:5432/${DB_NAME}"
echo
echo "Next steps from your workstation:"
echo "  export CORTEX_HOSTNAME=$(hostname -f 2>/dev/null || echo "<vps-host>")"
echo "  export CORTEX_USER=${USER}"
echo "  ./deploy.sh"
