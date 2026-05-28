#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
. "$SCRIPT_DIR/lib.sh"

usage() {
  cat <<'USAGE'
Usage: scripts/rebuild/inventory.sh [--output DIR] [--local-only]

Collect a read-only baseline inventory. By default, this connects to
$CORTEX_HOST and writes text artifacts under DIR.

Options:
  --output DIR   Output directory. Defaults to .rebuild/inventory/<timestamp>.
  --local-only   Collect only local repo inventory; do not SSH to the host.
USAGE
}

output_dir=""
local_only=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --output)
      output_dir="${2:-}"
      [ -n "$output_dir" ] || die "--output requires a directory"
      shift 2
      ;;
    --local-only|--local)
      local_only=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

if [ -z "$output_dir" ]; then
  output_dir="$REBUILD_ROOT/.rebuild/inventory/$(timestamp_utc)"
fi

ensure_output_dir "$output_dir" >/dev/null
copy_manifest_snapshot "$output_dir"

log "writing local repo inventory to $output_dir"
{
  write_section "Repo"
  printf 'root=%s\n' "$REBUILD_ROOT"
  git -C "$REBUILD_ROOT" rev-parse --show-toplevel
  git -C "$REBUILD_ROOT" rev-parse HEAD
  git -C "$REBUILD_ROOT" status --short

  write_section "Tracked Files"
  git -C "$REBUILD_ROOT" ls-files

  write_section "Rebuild Manifests"
  find "$MANIFEST_DIR" -maxdepth 1 -type f -print | sort
} >"$output_dir/local-repo.txt"

if [ "$local_only" -eq 1 ]; then
  log "local-only inventory complete"
  exit 0
fi

log "collecting read-only remote inventory from $CORTEX_HOST"

# shellcheck disable=SC2016
ssh_host 'printf "host=%s\n" "$(hostname)"; grep -E "^(PRETTY_NAME|VERSION_CODENAME)=" /etc/os-release; uname -srmo; id; groups' \
  >"$output_dir/host-os.txt"

ssh_host 'systemctl list-units --type=service --all --no-pager --plain --no-legend | sort' \
  >"$output_dir/systemd-units.txt"

ssh_host 'systemctl list-unit-files --type=service --no-pager --plain --no-legend | sort' \
  >"$output_dir/systemd-unit-files.txt"

ssh_host 'docker ps --format "{{.Names}}|{{.Image}}|{{.Ports}}|{{.Label \"com.docker.compose.project\"}}|{{.Label \"com.docker.compose.project.working_dir\"}}" | sort; printf "\n--- compose ---\n"; docker compose ls --format json 2>/dev/null || true' \
  >"$output_dir/docker.txt"

ssh_host 'ss -ltnup 2>/dev/null || true' \
  >"$output_dir/listening-ports.txt"

ssh_host 'apt-mark showmanual 2>/dev/null | sort; printf "\n--- snap ---\n"; snap list 2>/dev/null || true; printf "\n--- npm-global ---\n"; npm ls -g --depth=0 2>/dev/null || true; printf "\n--- pipx ---\n"; pipx list --short 2>/dev/null || true; printf "\n--- cargo ---\n"; cargo install --list 2>/dev/null || true' \
  >"$output_dir/packages.txt"

ssh_host 'printf "LOCAL_BIN\n"; ls -1 ~/.local/bin 2>/dev/null | sort || true; printf "USR_LOCAL_BIN\n"; ls -1 /usr/local/bin 2>/dev/null | sort || true' \
  >"$output_dir/local-bins.txt"

ssh_host 'printf "OPT_DIRS\n"; find /opt/cortexos -maxdepth 3 -mindepth 1 \( -name node_modules -o -name .pnpm -o -name .git \) -prune -o -type d -print 2>/dev/null | sort; printf "\nHERMES_PROFILES\n"; find /opt/cortexos/hermes/profiles -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sed "s#.*/##" | sort; printf "\nSECRETS_METADATA\n"; find /opt/cortexos/.secrets -maxdepth 3 -type f -printf "%m %u %g %p\n" 2>/dev/null | sed "s#/opt/cortexos/.secrets/#/opt/cortexos/.secrets/#" | sort' \
  >"$output_dir/cortexos-files.txt"

ssh_host 'printf "TAILSCALE_STATUS\n"; tailscale status --json 2>/dev/null | jq "{Version,TUN,BackendState,HaveNodeKey,TailscaleIPs,Self:(.Self | {HostName,DNSName,OS,TailscaleIPs,KeyExpiry,Online}),Health,MagicDNSSuffix,CurrentTailnet:(.CurrentTailnet | {MagicDNSSuffix,MagicDNSEnabled}),CertDomains}" 2>/dev/null || tailscale status --json 2>/dev/null || true; printf "\nTAILSCALE_SERVE\n"; tailscale serve status 2>/dev/null || true' \
  >"$output_dir/tailscale.txt"

ssh_host 'printf "CADDY_FILES\n"; find /etc/caddy -maxdepth 3 -type f -printf "%m %u %g %p\n" 2>/dev/null | sort; printf "\nCADDY_VALIDATE\n"; caddy validate --config /etc/caddy/Caddyfile 2>&1 || true' \
  >"$output_dir/caddy.txt"

ssh_host 'printf "TIMERS\n"; systemctl list-timers --all --no-pager --plain 2>/dev/null || true; printf "\nCRON\n"; ls -la /etc/cron* 2>/dev/null || true; printf "\nUSER_CRONTAB\n"; crontab -l 2>/dev/null || true' \
  >"$output_dir/cron-timers.txt"

# shellcheck disable=SC2016
ssh_host 'for name in celebrar.me mementry 3guns; do printf "PROJECT_NAME %s\n" "$name"; find /home/cortexos/Developer -path "*/$name/.git" -type d -prune 2>/dev/null | while IFS= read -r gitdir; do d=${gitdir%/.git}; printf "PROJECT %s\n" "$d"; git -C "$d" remote -v | sed -n "1,2p"; git -C "$d" rev-parse --abbrev-ref HEAD; git -C "$d" status --short | sed -n "1,120p"; done; done' \
  >"$output_dir/project-repos.txt"

log "inventory complete: $output_dir"
