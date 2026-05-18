#!/usr/bin/env bash
#
# vps-wipe.sh — Reset cortex VPS to fresh-install baseline.
#
# Removes: Docker (engine + data), all CortexOS/HomeOS/OpenClaw/CIEUCPB/netbook
# state, custom systemd units (system + user), custom cron, app packages
# (Postgres, Redis, NATS, MySQL, MongoDB, Caddy, Webmin, Cockpit, Fail2ban,
# Dnsmasq, Prometheus/Grafana/Fluent-bit/Telegraf), and project trees under
# /opt and ~.
#
# Preserves: sshd, sudo, networking, Tailscale (auth + state), gh CLI auth,
# /home/bloodf/.ssh, /home/bloodf/.gitconfig, base shell rc files.
#
# Usage on VPS as bloodf:
#   DRY_RUN=1 ./vps-wipe.sh                 # print what would happen
#   CONFIRM=yes-wipe-cortex ./vps-wipe.sh   # actually wipe
#
# Requires: sudo without password OR interactive sudo session.

set -uo pipefail
shopt -s nullglob

TS="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="/var/log/cortex-wipe-${TS}.log"
DRY_RUN="${DRY_RUN:-0}"
CONFIRM="${CONFIRM:-}"

if [[ "$DRY_RUN" != "1" && "$CONFIRM" != "yes-wipe-cortex" ]]; then
  cat <<EOF
Refusing to run. Set one of:
  DRY_RUN=1 $0                  # preview
  CONFIRM=yes-wipe-cortex $0    # execute
EOF
  exit 2
fi

if [[ "$EUID" -eq 0 ]]; then
  echo "Run as bloodf, not root. Script will sudo where needed." >&2
  exit 2
fi

sudo -n true 2>/dev/null || sudo true || { echo "sudo required" >&2; exit 2; }
sudo touch "$LOG" && sudo chown "$USER" "$LOG"

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf 'DRY  %s\n' "$*" | tee -a "$LOG"
  else
    printf 'RUN  %s\n' "$*" | tee -a "$LOG"
    eval "$@" 2>&1 | tee -a "$LOG" || true
  fi
}

banner() { printf '\n=== %s ===\n' "$*" | tee -a "$LOG"; }

banner "phase 0: preflight"
run "id"
run "tailscale status | head -5 || true"
run "gh auth status 2>&1 | head -5 || true"
run "df -h /"
run "test -f \"$HOME/.ssh/authorized_keys\" && echo ssh-keys-present || echo NO-SSH-KEYS"

banner "phase 1: stop services"
USER_UNITS=(
  cieucpb-daily-orixa-message.timer
  cieucpb-daily-orixa-message.service
  cieucpb-scheduled-reminders.timer
  cieucpb-scheduled-reminders.service
)
for u in "${USER_UNITS[@]}"; do
  run "systemctl --user stop $u || true"
  run "systemctl --user disable $u || true"
done
run "loginctl disable-linger $USER || true"

SYS_UNITS=(
  cortex-dashboard cortex-consumer openclaw-gateway 9router caddy
  cieucpb-backup.timer cieucpb-backup.service
  cortex-smoke@netbook.timer cortex-smoke@netbook.service
  dnsmasq fail2ban cockpit.socket cockpit
  postgresql redis-server nats-server mysql mariadb mongod webmin
  prometheus grafana-server fluent-bit telegraf
)
for u in "${SYS_UNITS[@]}"; do
  run "sudo systemctl stop $u 2>/dev/null || true"
  run "sudo systemctl disable $u 2>/dev/null || true"
done

banner "phase 2: docker purge"
run "sudo docker ps -aq | xargs -r sudo docker rm -f"
run "sudo docker volume ls -q | xargs -r sudo docker volume rm -f"
run "sudo docker network ls --filter type=custom -q | xargs -r sudo docker network rm"
run "sudo docker image ls -q | xargs -r sudo docker rmi -f"
run "sudo docker system prune -af --volumes"
run "sudo apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker.io || true"
run "sudo rm -rf /var/lib/docker /var/lib/containerd /etc/docker"

banner "phase 3: remove unit files + cron"
run "sudo rm -f /etc/systemd/system/cortex-*.service /etc/systemd/system/cortex-*.timer"
run "sudo rm -f /etc/systemd/system/cieucpb-*.service /etc/systemd/system/cieucpb-*.timer"
run "sudo rm -f /etc/systemd/system/openclaw-*.service /etc/systemd/system/9router.service"
run "sudo rm -f /etc/systemd/system/cortex-smoke@*"
run "sudo find /etc/systemd/system/multi-user.target.wants -maxdepth 1 -type l \\( -name 'cortex-*' -o -name 'cieucpb-*' -o -name 'openclaw-*' -o -name '9router*' \\) -delete"
run "sudo systemctl daemon-reload"
run "sudo systemctl reset-failed"
run "rm -rf $HOME/.config/systemd/user"
run "crontab -r 2>/dev/null || true"
run "sudo crontab -r 2>/dev/null || true"

banner "phase 4: uninstall app packages"
APT_PURGE=(
  'postgresql*' postgresql-client-common postgresql-common
  redis-server redis-tools
  nats-server
  'mysql-server*' 'mysql-client*' mysql-common
  'mariadb-server*' 'mariadb-client*'
  'mongodb-org*' 'mongodb*'
  caddy webmin 'cockpit*' fail2ban dnsmasq
  'prometheus*' 'grafana*' fluent-bit telegraf
)
for pkg in "${APT_PURGE[@]}"; do
  run "sudo apt-get purge -y $pkg 2>/dev/null || true"
done
run "sudo apt-get autoremove --purge -y"
run "sudo apt-get clean"

run "sudo rm -f /usr/local/bin/openclaw /usr/local/bin/9router /usr/local/bin/nats /usr/local/bin/caddy"
run "sudo rm -f /usr/local/bin/cortex-* /usr/local/bin/homeos-*"
run "sudo rm -rf /etc/caddy /etc/nats /etc/9router /etc/openclaw /etc/prometheus /etc/grafana"
run "sudo rm -rf /var/lib/postgresql /var/lib/mysql /var/lib/mongodb /var/lib/redis /var/lib/nats /var/lib/prometheus /var/lib/grafana"
run "sudo rm -rf /var/log/cortex* /var/log/openclaw* /var/log/9router* /var/log/postgresql /var/log/mysql /var/log/mongodb /var/log/redis"

banner "phase 5: wipe project trees (system)"
run "sudo rm -rf /opt/cortexos /opt/homeos /opt/vc /opt/containerd /opt/apps"

banner "phase 5: wipe project trees (user home)"
USER_RM=(
  .openclaw state stacks templates skills plugin-skills development
  cortex-backups cortexos-maintenance lancedb logs backups dashboard
  flows memory completions docs scripts bin
  AGENTS.md MEMORY.md SOUL.md IDENTITY.md TOOLS.md USER.md HEARTBEAT.md
  cortexos-vps-refresh.js
  '--ack' '--ack=explicit' '200' '308' '404' 'EOF'
)
for d in "${USER_RM[@]}"; do
  run "rm -rf \"$HOME/$d\""
done
run "rm -f $HOME/crontab.backup.* $HOME/agent-*.tgz $HOME/cortexos-agent-templates-*.tgz"
run "rm -f $HOME/cortex.tailfd052e.ts.net.crt $HOME/cortex.tailfd052e.ts.net.key"
run "rm -rf $HOME/.npm $HOME/.cache"
run "rm -rf $HOME/.local/share/nats $HOME/.local/share/openclaw $HOME/.local/share/9router"
run "rm -rf $HOME/.config/openclaw $HOME/.config/9router $HOME/.config/nats"

# Optional: leave .nvm/.fnm/.cargo/.rustup since they're toolchains, not project state
# Optional: leave snap dir managed by snapd

banner "phase 6: verify"
run "df -h /"
run "sudo systemctl list-units --failed --no-pager"
run "sudo systemctl list-unit-files --state=enabled --no-pager | grep -iE 'cortex|cieucpb|openclaw|9router|caddy|prometheus|grafana' || echo CLEAN"
run "command -v docker >/dev/null && docker ps || echo docker-removed"
run "tailscale status | head -5 || true"
run "gh auth status 2>&1 | head -5 || true"
run "ls $HOME"
run "ls $HOME/.ssh"

echo
echo "Wipe finished. Log: $LOG"
echo "Next: reboot, then snapshot VPS as fresh baseline."
