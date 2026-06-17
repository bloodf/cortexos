# 30f - 9Remote

## Purpose

Install [9Remote](https://9remote.cc) as a local CortexOS service: a
browser-based remote terminal for the host, reachable from your phone or
any tailnet device. Run in **web-UI mode** (`9remote ui`) so it serves the
dashboard directly without a Cloudflare tunnel — access stays on the tailnet.

> 9Remote hands out interactive shells. Its auth boundary is device
> pairing (a machine-bound permanent key + a 30-min QR key), not a
> reverse proxy. Treat any paired device as having a shell on the host.

## Prerequisites

- `00-preflight.md` completed (Node.js available at `/usr/bin/node`).
- A tailnet (`12-tailscale.md`) — that is how you reach the UI.

## Ports / paths

| Item | Value |
| --- | --- |
| Web UI | `0.0.0.0:2208` (see bind note below) |
| Service HOME (keys) | `/opt/cortexos/data/9remote` |
| Global install prefix | `/opt/cortexos/data/9remote/.npm-global` |
| Unit | `cortex-9remote.service` |

> **Bind note:** `9remote ui` calls Node `listen(PORT)` with no host arg, so
> it binds **all interfaces** — there is no env knob to force loopback.
> Therefore we do **not** `tailscale serve` it (serve binds the tailnet IP
> on the same port and would collide — see
> [[webui-url-architecture]]). Reach it directly at
> `http://<tailnet-host>:2208/`; the tailnet hop is wireguard-encrypted and
> `ufw` already allows all of `tailscale0`. To also block the physical LAN:
> `sudo ufw deny in on <lan-iface> to any port 2208`.

## Install

Self-contained global install into the service HOME (so the machine-bound
key lives next to the binary). Native deps (`node-pty`, `sharp`, …) need
their postinstall scripts, hence `--allow-scripts`:

```bash
sudo install -d -o cortexos -g cortexos -m 0700 /opt/cortexos/data/9remote

sudo -u cortexos env \
  HOME=/opt/cortexos/data/9remote \
  npm_config_prefix=/opt/cortexos/data/9remote/.npm-global \
  npm install -g \
    --allow-scripts=9remote,@hurdlegroup/robotjs,@julusian/jpeg-turbo,bufferutil,node-datachannel,node-pty,sharp,utf-8-validate \
    9remote@2.0.21
```

## Install the service

```bash
sudo bash scripts/ops/cortex-render-units.sh cortex-9remote.service
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-9remote.service
```

## Verify

```bash
# Listening + serving
ss -tlnp | grep 2208
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:2208/api/health  # 200

# Service healthy
systemctl is-active cortex-9remote.service                                   # active
```

> `/` returns **403** until a device is paired — that is the auth gate, not
> a fault. Use `/api/health` for liveness (it is the dashboard probe target).

## Pair a device

9Remote shows its QR / one-time key only in the **interactive TUI** (argv
subcommands fall through to the menu, and the headless service has no TTY to
display it). Pair once from a terminal on the host:

```bash
# type this in the session prompt so it runs in your terminal:
sudo -u cortexos env HOME=/opt/cortexos/data/9remote /usr/bin/node \
  /opt/cortexos/data/9remote/.npm-global/lib/node_modules/9remote/dist/cli.cjs
# → choose "Terminal UI", scan the QR / copy the key-bearing URL
```

The permanent key is machine-bound (derived from `/etc/machine-id`); the
key-bearing URL it prints is what unlocks `http://<tailnet-host>:2208/`
from your phone or another tailnet device.

## Dashboard registration

The catalog row + health probe ship as migration `018_9remote_seed.sql`
(applied at dashboard startup; loopback probe `/api/health`, healthcheck
visibility). The public Apps URL is **not** hardcoded — it is assigned
per-install by `cortex_set_service_urls(base_url)` (migration `019`) from your
own tailnet host, built as plain `http://<host>:2208/` (9remote serves http):

```bash
SELECT cortex_set_service_urls('https://<your-tailnet-host>');
```

## Rollback

```bash
sudo systemctl disable --now cortex-9remote.service
sudo rm /etc/systemd/system/cortex-9remote.service
sudo systemctl daemon-reload
sudo rm -rf /opt/cortexos/data/9remote   # also drops the paired-device key
```

## Next

Per `prompts/tools/_order.md` — continue with `30e-headroom.md` /
`31-9router.md`.
