# Tailscale (latest)

## Purpose

Join the VPS to the operator's Tailscale tailnet so all inter-service traffic can flow over the encrypted mesh without exposing additional public ports.

## Prerequisites

- `11-docker.md` completed.
- A Tailscale auth key from <https://login.tailscale.com/admin/settings/keys> (one-time, reusable, or ephemeral — your choice).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm you have a valid Tailscale auth key ready. Set it in your shell:

```bash
export TAILSCALE_AUTHKEY="tskey-auth-<your-key>"
```

Type "confirmed" to proceed.

## Install

```bash
if [ "$(pkg_family)" = "ubuntu" ]; then
  curl -fsSL https://tailscale.com/install.sh | sh
elif [ "$(pkg_family)" = "fedora" ]; then
  sudo dnf config-manager --add-repo https://pkgs.tailscale.com/stable/fedora/tailscale.repo
  pkg_install tailscale
  sudo systemctl enable --now tailscaled
elif [ "$(pkg_family)" = "rhel" ]; then
  # RHEL: enable CRB+EPEL via prompts/os/10-rhel-prereqs.md (P6 stub)
  sudo dnf config-manager --add-repo https://pkgs.tailscale.com/stable/rhel/$(rpm -E %rhel)/tailscale.repo
  pkg_install tailscale
  sudo systemctl enable --now tailscaled
fi
```

Verify package install (family-appropriate):

```bash
if [ "$(pkg_family)" = "ubuntu" ]; then dpkg -s tailscale >/dev/null; else rpm -qi tailscale >/dev/null; fi
```

## Configure

```bash
sudo tailscale up \
  --authkey="${TAILSCALE_AUTHKEY}" \
  --hostname="{VPS_HOSTNAME}" \
  --advertise-tags=tag:cortex \
  --ssh
```

Replace `{VPS_HOSTNAME}` with the short hostname for this VPS (e.g. `cortex`).

Enable IP forwarding (required if you plan to use subnet routing):

```bash
echo 'net.ipv4.ip_forward = 1' | sudo tee -a /etc/sysctl.d/99-cortex.conf
echo 'net.ipv6.conf.all.forwarding = 1' | sudo tee -a /etc/sysctl.d/99-cortex.conf
sudo sysctl --system
```

## Verify

```bash
tailscale status
tailscale ip -4
```

Expected: node shows as `online`, a `100.x.x.x` IP is printed.

## CHECKPOINT 2

Operator: confirm the VPS appears in your Tailscale admin console as online and the Tailscale IP is reachable from another device on your tailnet. Type "confirmed" to proceed.

## Next

→ `prompts/tools/13-caddy.md`
