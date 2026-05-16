#!/bin/bash
set -euo pipefail

# Cortex Dashboard Deployment Script
# Builds locally and deploys to VPS via rsync.
# Flags:
#   --build-only      build + rsync, skip migrate
#   --migrate         run pending DB migrations on the VPS (idempotent)
#   --fresh           drop+recreate DB, then full deploy (interactive confirm)
#   --prune-backups N keep most recent N backup dirs (default 5)

VPS_HOST="${CORTEX_HOSTNAME:-${CORTEX_IP:?Set CORTEX_HOSTNAME or CORTEX_IP}}"
VPS_USER="${CORTEX_USER:?Set CORTEX_USER}"
REMOTE_DIR="${CORTEX_DASHBOARD_DIR:-/opt/cortexos/dashboard}"
NODE_BIN="${NODE_BIN:-/home/linuxbrew/.linuxbrew/opt/node@24/bin/node}"
BACKUP_DIR="${CORTEX_BACKUP_DIR:-/opt/cortexos/backups/dashboard}"
DEPLOY_ID="$(date +%Y%m%d-%H%M%S)"
HEALTH_URL="${CORTEX_DASHBOARD_HEALTH_URL:-http://${VPS_HOST}:3080/en/login}"
PRUNE_KEEP=5

BUILD_ONLY=0
MIGRATE_ONLY=0
DO_MIGRATE=1
FRESH=0

while [[ $# -gt 0 ]]; do
	case "$1" in
		--build-only) BUILD_ONLY=1; DO_MIGRATE=0; shift ;;
		--migrate)    MIGRATE_ONLY=1; shift ;;
		--fresh)      FRESH=1; shift ;;
		--prune-backups) PRUNE_KEEP="${2:-5}"; shift 2 ;;
		*) echo "Unknown flag: $1" >&2; exit 2 ;;
	esac
done

run_remote_migrate() {
	echo "=== Running migrations on ${VPS_HOST} ==="
	ssh "${VPS_USER}@${VPS_HOST}" "
		set -e
		cd '${REMOTE_DIR}'
		# Load dashboard env via sudo (file is 0600 root). Prefer migrate.js.
		ENV_FILE=/opt/cortexos/secrets/dashboard.env
		if [ -f 'scripts/migrate.js' ]; then
			sudo -E env CORTEX_ENV_FILE=\"\$ENV_FILE\" bash -c 'set -a; . \"\$CORTEX_ENV_FILE\"; set +a; exec '${NODE_BIN}' scripts/migrate.js'
		else
			sudo -E env CORTEX_ENV_FILE=\"\$ENV_FILE\" bash -c 'set -a; . \"\$CORTEX_ENV_FILE\"; set +a; exec '${NODE_BIN}' --experimental-strip-types scripts/migrate.ts'
		fi
	"
}

run_remote_fresh() {
	read -r -p "DROP and recreate cortex_dashboard DB on ${VPS_HOST}? [yes/N] " ans
	[[ "$ans" == "yes" ]] || { echo "Aborted."; exit 1; }
	ssh "${VPS_USER}@${VPS_HOST}" "
		set -e
		sudo -u postgres psql -c \"DROP DATABASE IF EXISTS cortex_dashboard;\"
		sudo -u postgres psql -c \"CREATE DATABASE cortex_dashboard OWNER dashboard;\"
	"
}

prune_backups_remote() {
	echo "=== Pruning backups (keeping most recent ${PRUNE_KEEP}) ==="
	ssh "${VPS_USER}@${VPS_HOST}" "
		set -e
		cd '${BACKUP_DIR}' 2>/dev/null || exit 0
		ls -1tr | head -n -${PRUNE_KEEP} | xargs -r -I{} sudo rm -rf -- '{}'
	"
}

if [[ $MIGRATE_ONLY -eq 1 ]]; then
	run_remote_migrate
	echo "=== Done (migrate only) ==="
	exit 0
fi

rollback() {
	echo "=== Rolling back dashboard ===" >&2
	ssh "${VPS_USER}@${VPS_HOST}" "
		set -e
		if [ -d '${BACKUP_DIR}/${DEPLOY_ID}' ]; then
			sudo rsync -a --delete '${BACKUP_DIR}/${DEPLOY_ID}/' '${REMOTE_DIR}/'
			sudo systemctl restart cortex-dashboard
		fi
	"
}
trap 'rollback' ERR

echo "=== Building dashboard ==="
npx next build --webpack

if [[ $FRESH -eq 1 ]]; then
	run_remote_fresh
fi

echo "=== Deploying to ${VPS_HOST} ==="
ssh "${VPS_USER}@${VPS_HOST}" "sudo mkdir -p ${REMOTE_DIR} && sudo chown ${VPS_USER}:${VPS_USER} ${REMOTE_DIR}"
ssh "${VPS_USER}@${VPS_HOST}" "sudo mkdir -p ${BACKUP_DIR}/${DEPLOY_ID} && if [ -d ${REMOTE_DIR} ]; then sudo rsync -a --delete ${REMOTE_DIR}/ ${BACKUP_DIR}/${DEPLOY_ID}/; fi && sudo chown -R ${VPS_USER}:${VPS_USER} ${BACKUP_DIR}"

rsync -avz --delete \
	.next/standalone/ \
	"${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

rsync -avz \
	.next/static/ \
	"${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/.next/static/"

# Migrations + migrate CLI
rsync -avz --delete \
	migrations/ \
	"${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/migrations/"

rsync -avz --delete \
	scripts/ \
	"${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/scripts/"

# External deps not bundled in standalone (ssh2 native, bcryptjs for admin scripts)
echo "=== Copying external node_modules ==="
rsync -avz \
	--include='ssh2/***' --include='ssh2/**/' \
	--include='cpu-features/***' --include='cpu-features/**/' \
	--include='nan/***' \
	--include='bcryptjs/***' --include='bcryptjs/**/' \
	--include='buildcheck.js' --include='lib/protocol/*.js' \
	--exclude='*' \
	node_modules/ \
	"${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/node_modules/"

echo "=== Installing systemd service ==="
CORTEX_PATH_DEFAULT="/home/linuxbrew/.linuxbrew/bin:/usr/local/bin:/usr/bin:/bin"
RENDER_TMP="$(mktemp)"
sed \
  -e "s|__CORTEX_USER__|${VPS_USER}|g" \
  -e "s|__CORTEX_ROOT__|$(dirname "${REMOTE_DIR}")|g" \
  -e "s|__CORTEX_NODE_BIN__|${NODE_BIN}|g" \
  -e "s|__CORTEX_PATH__|${CORTEX_PATH:-${CORTEX_PATH_DEFAULT}}|g" \
  cortex-dashboard.service > "${RENDER_TMP}"
scp "${RENDER_TMP}" "${VPS_USER}@${VPS_HOST}:/tmp/cortex-dashboard.service"
rm -f "${RENDER_TMP}"
ssh "${VPS_USER}@${VPS_HOST}" "
  sudo mv /tmp/cortex-dashboard.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable cortex-dashboard
  sudo systemctl restart cortex-dashboard
"

if [[ $DO_MIGRATE -eq 1 ]]; then
	run_remote_migrate
fi

prune_backups_remote

echo "=== Health checking dashboard ==="
for i in {1..30}; do
	if curl -fsS --max-time 5 "${HEALTH_URL}" >/dev/null; then
		echo "Dashboard healthy"
		trap - ERR
		echo "=== Done ==="
		echo "Dashboard: https://${VPS_HOST}"
		exit 0
	fi
	sleep 2
done
echo "Dashboard health check failed (URL=${HEALTH_URL})" >&2
false
