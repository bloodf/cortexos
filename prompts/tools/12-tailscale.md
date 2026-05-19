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

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — Tailscale account reachable in browser
- [ ] Install Tailscale via `curl ... install.sh | sh`
- [ ] `sudo systemctl enable --now tailscaled`
- [ ] Run `sudo tailscale up --hostname --advertise-tags=tag:cortex --ssh` and approve in browser
- [ ] Append IPv4 + IPv6 forwarding to `/etc/sysctl.d/99-cortex.conf` and `sudo sysctl --system`
- [ ] Confirm `tailscale ip -4` prints a `100.x.x.x` address
- [ ] CHECKPOINT 2 confirmed — node visible in admin console + tailnet IP reachable

## CHECKPOINT 1

**STOP — operator question:** Can you currently sign into the Tailscale admin console in a browser on your laptop (so the `tailscale up` interactive flow can be approved)?

No token needs to be pre-set — the install uses Tailscale's interactive
login flow.

Type `confirmed` to proceed.

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

**STOP — operator question:** Does `tailscale status` print this node as `online` with a `100.x.x.x` address, AND can another tailnet device `ping` that `100.x.x.x` (not `offline`, not `host unreachable`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/12a-sops-bootstrap.md`
