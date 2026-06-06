# Hermes Web UI (nesquena/hermes-webui)

## Purpose

Install the upstream [nesquena/hermes-webui](https://github.com/nesquena/hermes-webui) on the host and (optionally) per-profile on each Incus instance. The Hermes Web UI is the operator-facing UI for the Hermes agent runtime — a static SPA + Python `http.server` back end that the team exposes on the tailnet.

Background and feasibility evidence: `docs/research/hermes-webui-feasibility.md` (commit `416a38a`, branch `research/hermes-webui-boxbox` — also vendored on this branch at `docs/research/`). The two non-negotiable security conditions from the feasibility study: **always front with Caddy + Tailscale Serve, and set `HERMES_WEBUI_PASSWORD` before exposing externally**.

## Prerequisites

- `10-os-hardening.md` completed.
- `11-docker.md` completed (Docker is the recommended install path — see "Install surface" below).
- `13-caddy.md` completed (Caddy reverse-proxy will route `/hermes/*` to the upstream).
- `12-tailscale-serve.md` completed if you plan to expose the UI to the tailnet.
- The Hermes agent runtime (`prompts/tools/40-hermes.md`) installed and reachable on `http://127.0.0.1:8932` per profile — Hermes Web UI is the operator surface on top of the agent runtime, not a replacement for it.

## Install surface

Two paths are documented in the research. The **production path** (used by the upstream's Dockerfile + our `cortex-render-units.sh` flow) is the **Docker image**. The bare-metal path (`pip install -r requirements.txt` + `python3 server.py`) is documented for dev only.

This prompt covers the **Docker path**. If you need bare-metal for a one-off reason, see the "Bare-metal fallback" appendix at the end.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo` (systemd unit install, Caddy config snippet). Authenticate **now**:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used.

## Ask user

> The following questions gate the install. **Type your answers, then `confirmed`** to proceed.

| Field | Default | Example |
| --- | --- | --- |
| Install path on host (CORTEX_ROOT + relative) | `/opt/cortexos/hermes-webui` | `/opt/cortexos/hermes-webui` |
| Bind port (loopback only) | `18787` | `18787` |
| Hermes Web UI public path (Caddy will route this) | `/hermes/` | `/hermes/` |
| Per-profile install on existing Incus instances? | `no` | `yes` |
| Auth password (MUST be set before any external exposure) | — | a 24+ char random string |

```bash
read -p "Install path [${HERMES_WEBUI_INSTALL_PATH:-/opt/cortexos/hermes-webui}]: " _p
HERMES_WEBUI_INSTALL_PATH="${_p:-/opt/cortexos/hermes-webui}"
read -p "Bind port [${HERMES_WEBUI_BIND_PORT:-18787}]: " _bp
HERMES_WEBUI_BIND_PORT="${_bp:-18787}"
read -p "Caddy public path [${HERMES_WEBUI_PUBLIC_PATH:-/hermes/}]: " _pp
HERMES_WEBUI_PUBLIC_PATH="${_pp:-/hermes/}"
read -p "Install per-profile on existing Incus instances? (yes/no) [no]: " _prof
HERMES_WEBUI_PER_PROFILE="${_prof:-no}"
read -s -p "Auth password (HERMES_WEBUI_PASSWORD, will be stored in /opt/cortexos/.secrets/): " _pw
echo
: "${_pw:?HERMES_WEBUI_PASSWORD is required before any external exposure}"

export HERMES_WEBUI_INSTALL_PATH HERMES_WEBUI_BIND_PORT HERMES_WEBUI_PUBLIC_PATH HERMES_WEBUI_PER_PROFILE
```

The password goes to `/opt/cortexos/.secrets/hermes-webui.env` (mode 0600) and is sourced by the systemd unit. The systemd unit binds to loopback only.

## Todo

- [ ] CHECKPOINT 1 confirmed — operator answers captured, no prior Hermes Web UI install at `${HERMES_WEBUI_INSTALL_PATH}`
- [ ] Pull image `ghcr.io/nesquena/hermes-webui:v0.51.280` (pin to release tag, not `master`)
- [ ] Write `/opt/cortexos/.secrets/hermes-webui.env` (mode 0600) with `HERMES_WEBUI_PASSWORD`
- [ ] Write `/opt/cortexos/${HERMES_WEBUI_INSTALL_PATH##/opt/cortexos/}/docker-compose.yml` (the unit references this)
- [ ] `pkg_install` is **not** needed; only Docker is
- [ ] Write `templates/systemd/hermes-webui.service` (with `{CORTEX_ROOT}` placeholders) and render via `scripts/ops/cortex-render-units.sh`
- [ ] `service_enable hermes-webui` + `service_start hermes-webui`
- [ ] Add Caddy reverse-proxy snippet for `${HERMES_WEBUI_PUBLIC_PATH}` → `127.0.0.1:${HERMES_WEBUI_BIND_PORT}`
- [ ] `systemctl reload caddy` and `curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/health` returns 200 JSON
- [ ] CHECKPOINT 2 confirmed — health check 200, `curl http://<host>/${HERMES_WEBUI_PUBLIC_PATH}` renders SPA shell
- [ ] If `HERMES_WEBUI_PER_PROFILE=yes`, run the per-profile block in `prompts/tools/60-incus-project.md`

## CHECKPOINT 1

**STOP — operator question:** Has the install path question above been answered, the password captured, and the path `${HERMES_WEBUI_INSTALL_PATH}` confirmed not to exist (or empty) on this host?

```bash
test ! -e "${HERMES_WEBUI_INSTALL_PATH}" -o -z "$(ls -A ${HERMES_WEBUI_INSTALL_PATH} 2>/dev/null)"
```

Type `confirmed` to proceed.

## Install (host)

### 1. Pull the image

```bash
docker pull ghcr.io/nesquena/hermes-webui:v0.51.280
```

Pin to a release tag — the upstream release cadence is 5+ releases per day on `master`. The `:vX.Y.Z` pin matches the upstream's Dockerfile `ARG HERMES_VERSION` default.

### 2. Write the secrets file

```bash
sudo install -d -m 0700 -o root -g root /opt/cortexos/.secrets
sudo tee /opt/cortexos/.secrets/hermes-webui.env >/dev/null <<EOF
HERMES_WEBUI_PASSWORD=${_pw}
HERMES_WEBUI_STATE_DIR=/var/lib/hermes-webui
HERMES_WEBUI_HOST=127.0.0.1
HERMES_WEBUI_PORT=${HERMES_WEBUI_BIND_PORT}
HERMES_WEBUI_NO_BROWSER=1
EOF
sudo chmod 0600 /opt/cortexos/.secrets/hermes-webui.env
sudo chown root:root /opt/cortexos/.secrets/hermes-webui.env
```

The image will run as the unprivileged `hermeswebui` user (uid/gid from the upstream Dockerfile), and the state dir at `/var/lib/hermes-webui` must be writable by it. Create the dir now:

```bash
sudo install -d -m 0755 -o 1000 -g 1000 /var/lib/hermes-webui
```

(Adjust uid/gid if your host's container-uid-range is non-default — the upstream image uses the standard 1000:1000 mapping per its `.env.docker.example`.)

### 3. docker-compose wrapper

```bash
sudo install -d "${HERMES_WEBUI_INSTALL_PATH}"
sudo tee "${HERMES_WEBUI_INSTALL_PATH}/docker-compose.yml" >/dev/null <<'YAML'
services:
  hermes-webui:
    image: ghcr.io/nesquena/hermes-webui:v0.51.280
    container_name: hermes-webui
    restart: unless-stopped
    env_file:
      - /opt/cortexos/.secrets/hermes-webui.env
    ports:
      - "127.0.0.1:18787:8787"
    volumes:
      - /var/lib/hermes-webui:/data
    healthcheck:
      test: ["CMD", "python3", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=2).read()"]
      interval: 30s
      timeout: 3s
      retries: 3
YAML
```

The `127.0.0.1:18787:8787` bind ensures the upstream's Docker-default `0.0.0.0:8787` is overridden to loopback. Adjust `${HERMES_WEBUI_BIND_PORT}` if you changed it.

### 4. systemd unit (rendered from committed template)

The unit template is committed at `templates/systemd/hermes-webui.service`
(per the W61 convention — matching `cortex-dashboard.service` which
is also committed under `templates/systemd/`). Use the existing render
flow to substitute `{CORTEX_ROOT}` and `{CORTEX_SECRETS_DIR}` from the
template into the live `/etc/systemd/system/` tree:

```bash
# 1. Render the template (substitutes the placeholders)
sudo bash scripts/ops/cortex-render-units.sh hermes-webui.service

# 2. Reload systemd, enable + start
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-webui.service

# 3. Verify the rendered WorkingDirectory points to the right install dir
sudo systemctl show hermes-webui.service -p WorkingDirectory
# Expected: WorkingDirectory=/opt/cortexos/hermes-webui
```

The render script discovers the repo root from its own path and defaults
`CORTEX_ROOT` to that — pass `CORTEX_ROOT=/opt/cortexos` explicitly if
the repo lives there (the production layout, per the audit-fixes W52
follow-up). Do NOT hand-edit the rendered unit at
`/etc/systemd/system/hermes-webui.service` — re-run the render script
on any change.

The template body (the canonical source) is at
`templates/systemd/hermes-webui.service` in this repo. Read it before
modifying; the unit is one-shot + RemainAfterExit because the actual
work is `docker compose up -d --wait`, not a long-running child
process the kernel needs to track.

### 5. Caddy reverse-proxy snippet

Append to the existing Caddyfile (do **not** rewrite the file — the existing routes for the dashboard, 9Router, etc. must survive):

```caddyfile
# Hermes Web UI (loopback only; Caddy terminates TLS, Tailscale Serve exposes)
handle_path ${HERMES_WEBUI_PUBLIC_PATH}* {
    reverse_proxy 127.0.0.1:${HERMES_WEBUI_BIND_PORT} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

The `handle_path` strips the `${HERMES_WEBUI_PUBLIC_PATH}` prefix before forwarding, so the upstream sees `/health`, `/login`, etc. — not `/hermes/health`. This is critical because the upstream's static-asset paths and CSRF logic assume the original URL shape.

Reload Caddy:

```bash
sudo systemctl reload caddy
```

### 6. Verify

```bash
# Health (loopback)
curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/health | jq

# SPA shell via Caddy (this is the operator-visible entry point)
curl -fsS http://127.0.0.1/${HERMES_WEBUI_PUBLIC_PATH%/} | head -3
```

Expected: the health endpoint returns `{"status":"ok",...}` with HTTP 200, and the SPA shell returns `<!doctype html>` (or the upstream's index template) with HTTP 200.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/health` return 200 JSON **and** `curl -fsS http://127.0.0.1/${HERMES_WEBUI_PUBLIC_PATH%/}` return the SPA shell HTML?

Type `confirmed` to proceed.

## Per-profile install on Incus (optional sub-section)

If `HERMES_WEBUI_PER_PROFILE=yes`, the install hook for each existing Incus instance lives in `prompts/tools/60-incus-project.md` step 6 ("Per-profile Hermes Web UI"). The pattern mirrors the existing `hermes-gateway-<profile>.service`:

- Inside each Incus instance, install Docker + pull the same image + write the same secrets file.
- Per-profile systemd unit: `hermes-webui-<profile>.service`, bound to a per-profile loopback port (e.g. `8933` to avoid colliding with the Hermes runtime on `8932`).
- Caddy in the Incus instance routes `/hermes/<profile>/*` to the per-profile port.

The detailed step-by-step is in `60-incus-project.md` so the install order stays flat; do not duplicate the steps here.

## Bare-metal fallback (dev only)

If Docker is not an option, install Python deps + run `server.py` directly:

```bash
sudo apt-get install -y python3 python3-venv python3-pip
sudo install -d -m 0755 /opt/cortexos/hermes-webui
git clone --depth=1 --branch v0.51.280 https://github.com/nesquena/hermes-webui.git /opt/cortexos/hermes-webui
python3 -m venv /opt/cortexos/hermes-webui/venv
/opt/cortexos/hermes-webui/venv/bin/pip install -r /opt/cortexos/hermes-webui/requirements.txt
```

Then a different systemd unit (`hermes-webui-bare.service`) wrapping `venv/bin/python3 -u server.py`. Bare-metal is **not** recommended for production — the upstream's Dockerfile applies the unprivileged-user + healthcheck + UV hardening that the bare path skips.

## Next

→ `prompts/tools/30b-fzf.md` (install fzf on the host; the per-profile step is in `60-incus-project.md`)

→ If `HERMES_WEBUI_PER_PROFILE=yes`, run `prompts/tools/60-incus-project.md` step 6 on every existing Incus instance.

→ `prompts/tools/30c-boxbox.md` (host-only file manager; per-profile install is **not** part of the brief)
