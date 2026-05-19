# Tailscale (latest)

## Purpose

Join the VPS to the operator's Tailscale tailnet so all inter-service traffic can flow over the encrypted mesh without exposing additional public ports.

## Prerequisites

- `11-docker.md` completed.
- A Tailscale account (free tier is fine). No pre-generated auth key required —
  this prompt uses the interactive browser-login flow (`tailscale up`) so the
  operator authenticates on first run.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm you have access to your Tailscale account in a browser.
No token needs to be pre-set — the install uses Tailscale's interactive
login flow. Type "confirmed" to proceed.

## Install

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo systemctl enable --now tailscaled
```

Verify package install:

```bash
dpkg -s tailscale >/dev/null
```

## Configure

Run `tailscale up` without `--authkey`. Tailscale prints a one-time URL;
open it in any browser, sign in, and approve the node.

```bash
sudo tailscale up \
  --hostname="${CORTEX_HOSTNAME:-cortex}" \
  --advertise-tags=tag:cortex \
  --ssh
```

`${CORTEX_HOSTNAME}` comes from the `SETUP.md` questionnaire (defaults to
`cortex`).

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
