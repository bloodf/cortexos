#!/usr/bin/env bash
# cortex-host-memory-hardening.sh — stop the CortexOS host from OOM-killing the
# user session (which kills the tmux server and every pane, e.g. live `claude`
# sessions). Idempotent; safe to re-run.
#
# Root cause this fixes (observed 2026-05-30):
#   - The box (30 GiB RAM, single 8 GiB swapfile, fully consumed) hit the global
#     kernel OOM killer. It killed `user@1000.service` (the per-user systemd
#     manager) — `Main process exited, code=killed, status=9/KILL` — which tears
#     down the whole user process tree, tmux included.
#   - `user@1000.service` shipped with OOMScoreAdjust=100 (MORE likely to be
#     killed) and the user had Linger=no (so any clean disconnect also reaps the
#     session).
#
# What it does:
#   1. enable-linger        -> user manager (and tmux) survives disconnects
#   2. OOM protection       -> user manager + tmux become near-immune; an OOM
#                              event takes a leaf process (one pane / a service),
#                              never the whole session tree
#   3. zram swap            -> fast compressed swap, used first
#   4. disk swapfile        -> large NVMe overflow so the hard-OOM never fires
#   5. vm sysctls           -> tuned for swap-on-zram
#
# Run:  sudo /opt/cortexos/scripts/ops/cortex-host-memory-hardening.sh
set -euo pipefail

CORTEX_USER="${CORTEX_USER:-cortexos}"
ZRAM_SIZE_MB="${ZRAM_SIZE_MB:-10240}"        # 10 GiB compressed (zstd ~3:1)
SWAPFILE="${SWAPFILE:-/swap2.img}"
SWAPFILE_SIZE_GB="${SWAPFILE_SIZE_GB:-46}"   # NVMe overflow, low priority (8G /swap.img + 10G zram + 46G = 64G total)
SWAPFILE_PRIO="${SWAPFILE_PRIO:-10}"
ZRAM_PRIO="${ZRAM_PRIO:-100}"

log() { printf '\n=== %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then echo "must run as root (use sudo)" >&2; exit 1; fi

# --- 1. linger ---------------------------------------------------------------
log "enabling linger for $CORTEX_USER"
loginctl enable-linger "$CORTEX_USER"

# --- 2. OOM protection for the user manager + tmux ---------------------------
log "protecting user@ manager from the OOM killer (drop-in)"
uid="$(id -u "$CORTEX_USER")"
install -d -m 0755 "/etc/systemd/system/user@${uid}.service.d"
cat >"/etc/systemd/system/user@${uid}.service.d/oom.conf" <<'EOF'
# The per-user systemd manager must outlive an OOM event so the session tree
# (tmux + panes) is never decapitated. Default shipped value was +100.
[Service]
OOMScoreAdjust=-900
EOF
systemctl daemon-reload
# Apply live to the already-running manager + any running tmux servers, since the
# drop-in only takes effect on the next start of user@.service.
mainpid="$(systemctl show "user@${uid}.service" -p MainPID --value 2>/dev/null || echo 0)"
if [ "${mainpid:-0}" -gt 0 ] && [ -w "/proc/$mainpid/oom_score_adj" ]; then
  echo -900 >"/proc/$mainpid/oom_score_adj" && echo "  user manager pid $mainpid -> oom_score_adj=-900"
fi
for tp in $(pgrep -x tmux || true); do
  echo -800 >"/proc/$tp/oom_score_adj" 2>/dev/null && echo "  tmux pid $tp -> oom_score_adj=-800"
done

# --- 3. zram (fast compressed swap, highest priority) ------------------------
log "configuring zram swap (${ZRAM_SIZE_MB} MiB, zstd, prio ${ZRAM_PRIO})"
if apt-get install -y --no-install-recommends systemd-zram-generator >/dev/null 2>&1; then
  cat >/etc/systemd/zram-generator.conf <<EOF
[zram0]
zram-size = ${ZRAM_SIZE_MB}
compression-algorithm = zstd
swap-priority = ${ZRAM_PRIO}
EOF
  systemctl daemon-reload
  systemctl restart "systemd-zram-setup@zram0.service" 2>/dev/null \
    || systemctl start "systemd-zram-setup@zram0.service" 2>/dev/null || true
else
  echo "  systemd-zram-generator unavailable; installing a self-managed unit"
  modprobe zram || true
  cat >/etc/systemd/system/cortex-zram.service <<EOF
[Unit]
Description=CortexOS zram swap
After=local-fs.target
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStartPre=/sbin/modprobe zram
ExecStart=/bin/bash -c 'zid=\$(zramctl -f -a zstd -s ${ZRAM_SIZE_MB}M); mkswap \$zid; swapon -p ${ZRAM_PRIO} \$zid'
ExecStop=/bin/bash -c 'swapoff /dev/zram0 || true; zramctl -r /dev/zram0 || true'
[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now cortex-zram.service
fi

# --- 4. disk overflow swapfile (large, low priority) -------------------------
log "ensuring ${SWAPFILE_SIZE_GB} GiB overflow swapfile at ${SWAPFILE}"
if ! swapon --show=NAME --noheadings | grep -qx "$SWAPFILE"; then
  if [ ! -f "$SWAPFILE" ]; then
    fallocate -l "${SWAPFILE_SIZE_GB}G" "$SWAPFILE" \
      || dd if=/dev/zero of="$SWAPFILE" bs=1M count=$((SWAPFILE_SIZE_GB*1024)) status=progress
  fi
  chmod 600 "$SWAPFILE"
  mkswap "$SWAPFILE" >/dev/null
  swapon -p "$SWAPFILE_PRIO" "$SWAPFILE"
  if ! grep -q "^${SWAPFILE} " /etc/fstab; then
    printf '%s none swap sw,pri=%s 0 0\n' "$SWAPFILE" "$SWAPFILE_PRIO" >>/etc/fstab
  fi
fi

# --- 5. vm sysctls tuned for zram swap ---------------------------------------
log "applying vm sysctls"
cat >/etc/sysctl.d/99-cortex-memory.conf <<'EOF'
# Prefer pushing idle anonymous pages to (fast, compressed) zram swap.
vm.swappiness = 100
vm.page-cluster = 0
vm.watermark_scale_factor = 200
EOF
sysctl --quiet -p /etc/sysctl.d/99-cortex-memory.conf

log "done — current swap & protection:"
swapon --show
printf 'Linger=%s\n' "$(loginctl show-user "$CORTEX_USER" -p Linger --value)"
free -h | sed -n '1,3p'
