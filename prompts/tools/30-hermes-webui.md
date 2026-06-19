# 30 - Hermes Web UI (nesquena/hermes-webui) — **systemd**

## Purpose

Install the upstream [nesquena/hermes-webui](https://github.com/nesquena/hermes-webui) on the host as a **systemd unit** running the upstream Python `server.py` directly under a dedicated virtualenv — no Docker. The Hermes Web UI is the operator-facing UI for the Hermes agent runtime: a static SPA + Python `http.server` backend that the team exposes on the tailnet.

Background and feasibility evidence: `docs/research/hermes-webui-feasibility.md` (commit `416a38a`, branch `research/hermes-webui-boxbox` — also vendored on this branch at `docs/research/`). The two non-negotiable security conditions from the feasibility study: **always front with Caddy + Tailscale Serve, and set `HERMES_WEBUI_PASSWORD` before exposing externally**.

> **Why systemd and not Docker** (changed 2026-06-19). The previous Docker-based install (`docker compose up` inside a unit) had two recurring failure modes: (1) the upstream `docker_init.bash` does a heavy UID/GID dance against bind mounts that crashes on the first `c82fbd…` style image hash when state-dir ownership changes (e.g. after a `systemctl reset-failed`), and (2) `docker compose` only forwards env vars to the container that are explicitly referenced as `${VAR}` in the compose file, so adding a single new env var (e.g. `HERMES_WEBUI_ONBOARDING_OPEN`) silently requires a compose edit. The systemd path runs the upstream's `server.py` directly inside a venv with the same env vars the unit sets — the same code, the same config schema, no container layer.

## Prerequisites

- `10-os-hardening.md` completed.
- `11-python-toolchain.md` completed (Python 3.12+ and `uv` or `python3-venv` + `pip` available; see "Toolchain" below).
- `13-caddy.md` completed (Caddy reverse-proxy will route `/hermes/*` to the upstream).
- The Hermes agent runtime installed at `/home/cortexos/.hermes/hermes-agent` (so the WebUI's profile resolver finds it). The WebUI looks at `$HERMES_WEBUI_AGENT_DIR` first, then `$HERMES_HOME/hermes-agent` — see the resolution order in `api/profiles.py` inside the install.

## Install surface

This prompt covers the **systemd path** (recommended). The bare-metal `python3 server.py` shortcut that the upstream ships is identical to this — there's no Dockerfile-only logic. The legacy Docker path is preserved at the bottom of this prompt for operators who already have a Docker-based install and want to keep it.

## Toolchain

Two equivalent ways to build the venv:

```bash
# Option A — uv (preferred, fast)
which uv || sudo -u cortexos /home/cortexos/.local/bin/uv --version

# Option B — stock venv (works without uv)
/usr/bin/python3 -m venv --help 2>&1 | head -1
```

If neither is present, run `prompts/tools/11-python-toolchain.md` first.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
if [ "$(pkg_family)" = "unknown" ]; then
    echo "WARNING: OS family not detected. Run prompts/os/00-os-selection.md first.
fi
```

## Sudo gate

This spoke runs `sudo` (systemd unit install, secrets file, optional Caddy). Authenticate **now**:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used.

## Ask user

> The following questions gate the install. **Type your answers, then `confirmed`** to proceed.

| Field | Default | Example |
| --- | --- | --- |
| Install path on host | `/opt/cortexos/hermes-webui` | `/opt/cortexos/hermes-webui` |
| Bind port (loopback only) | `18787` | `18787` |
| Hermes Web UI public path (Caddy routes this) | `/hermes/` | `/hermes/` |
| Hermes Web UI release tag (upstream `vX.Y.Z`) | `v0.51.340` | `v0.51.340` |
| Per-profile install on existing Incus instances? | `no` | `yes` |
| Auth password (MUST be set before any external exposure) | — | a 24+ char random string |

```bash
read -p "Install path [/opt/cortexos/hermes-webui]: " _p
HERMES_WEBUI_INSTALL_PATH="${_p:-/opt/cortexos/hermes-webui}"
read -p "Bind port [18787]: " _bp
HERMES_WEBUI_BIND_PORT="${_bp:-18787}"
read -p "Caddy public path [/hermes/]: " _pp
HERMES_WEBUI_PUBLIC_PATH="${_pp:-/hermes/}"
read -p "Upstream release tag [v0.51.340]: " _tag
HERMES_WEBUI_VERSION="${_tag:-v0.51.340}"
read -p "Install per-profile on existing Incus instances? (yes/no) [no]: " _prof
HERMES_WEBUI_PER_PROFILE="${_prof:-no}"
read -s -p "Auth password (HERMES_WEBUI_PASSWORD, will be stored in /opt/cortexos/.secrets/): " _pw
echo
: "${_pw:?HERMES_WEBUI_PASSWORD is required before any external exposure}"

export HERMES_WEBUI_INSTALL_PATH HERMES_WEBUI_BIND_PORT HERMES_WEBUI_PUBLIC_PATH \
       HERMES_WEBUI_VERSION HERMES_WEBUI_PER_PROFILE
```

The password goes to `/opt/cortexos/.secrets/hermes-webui.env` (mode 0600) and is sourced by the systemd unit. The unit binds to loopback only.

If you want to **disable auth entirely** (e.g. dev only, behind a Tailscale-only tailnet with no other exposure), write `HERMES_WEBUI_PASSWORD=` (empty) in the env file. The unit and the WebUI's password gate both treat the empty string as "no auth required". You can also add `HERMES_WEBUI_ONBOARDING_OPEN=1` to allow the onboarding endpoints from non-loopback clients (also covered below).

## Todo

- [ ] CHECKPOINT 1 confirmed — operator answers captured, no prior Hermes Web UI install at `${HERMES_WEBUI_INSTALL_PATH}`
- [ ] `git clone` upstream `${HERMES_WEBUI_VERSION}` tag to `${HERMES_WEBUI_INSTALL_PATH}`
- [ ] Create the venv and `pip install -r requirements.txt` + `hermes-agent[all]`
- [ ] Write `/opt/cortexos/.secrets/hermes-webui.env` (mode 0600)
- [ ] Pick a writable `HERMES_WEBUI_DEFAULT_WORKSPACE` (defaults to `/var/lib/hermes-webui/workspace` on this layout) and create it
- [ ] Ensure the systemd user `hermes-webui` can read `$HERMES_HOME` (and the agent dir under it) — chmod o+rX on `/home/cortexos` and `/home/cortexos/.hermes`
- [ ] Write `templates/systemd/hermes-webui.service` and render via `scripts/ops/cortex-render-units.sh`
- [ ] `service_enable hermes-webui` + `service_start hermes-webui`
- [ ] Add Caddy reverse-proxy snippet for `${HERMES_WEBUI_PUBLIC_PATH}` → `127.0.0.1:${HERMES_WEBUI_BIND_PORT}` (optional — Tailscale Serve already fronts :18787 directly)
- [ ] `systemctl reload caddy` (if you added a Caddy route) and `curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/health` returns 200 JSON
- [ ] CHECKPOINT 2 confirmed — health check 200, `/api/profiles` lists both `default` and any named profiles (e.g. `cortex`)
- [ ] If `HERMES_WEBUI_PER_PROFILE=yes`, run the per-profile block in `prompts/tools/60-incus-project.md`

## CHECKPOINT 1

**STOP — operator question:** Has the install path question above been answered, the password captured, and the path `${HERMES_WEBUI_INSTALL_PATH}` confirmed not to exist (or empty) on this host?

```bash
test ! -e "${HERMES_WEBUI_INSTALL_PATH}" -o -z "$(ls -A ${HERMES_WEBUI_INSTALL_PATH} 2>/dev/null)"
```

Type `confirmed` to proceed.

## Install (host)

### 1. Clone the upstream

```bash
sudo install -d -m 0755 -o cortexos -g cortexos "$(dirname ${HERMES_WEBUI_INSTALL_PATH})"
sudo -u cortexos git clone --depth 1 --branch "${HERMES_WEBUI_VERSION}" \
  https://github.com/nesquena/hermes-webui.git "${HERMES_WEBUI_INSTALL_PATH}"
```

Pin to a release tag — the upstream release cadence is multiple releases per day on `master`. The `${HERMES_WEBUI_VERSION}` pin matches the upstream's `ARG HERMES_VERSION` default.

> **Tag fragility note:** High-churn tags may be garbage-collected upstream. For production stability, pin to a digest after the first successful clone:
> ```bash
> sudo -u cortexos git -C "${HERMES_WEBUI_INSTALL_PATH}" fetch --tags --depth 100 origin "${HERMES_WEBUI_VERSION}"
> ```

### 2. Build the venv + install dependencies

The upstream's runtime requirements are minimal — `pyyaml` + `cryptography` (the latter only needed if you use the optional passkey/WebAuthn surface). The WebUI also pulls in the Hermes agent's Python deps so that the agent can run inside the same process; that install is the same `hermes-agent[all]` editable install the Hermes CLI uses.

```bash
# With uv (preferred):
sudo -u cortexos -H bash -lc "
  set -euo pipefail
  cd '${HERMES_WEBUI_INSTALL_PATH}'
  /home/cortexos/.local/bin/uv venv venv --python /usr/bin/python3
  /home/cortexos/.local/bin/uv pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
  /home/cortexos/.local/bin/uv pip install /home/cortexos/.hermes/hermes-agent[all] --trusted-host pypi.org --trusted-host files.pythonhosted.org
  /home/cortexos/.local/bin/uv pip install 'hindsight-client>=0.4.22' --trusted-host pypi.org --trusted-host files.pythonhosted.org
"

# Or with stock venv + pip (if uv is not installed):
sudo -u cortexos -H bash -lc "
  set -euo pipefail
  cd '${HERMES_WEBUI_INSTALL_PATH}'
  python3 -m venv venv
  ./venv/bin/pip install --quiet -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
  ./venv/bin/pip install --quiet /home/cortexos/.hermes/hermes-agent[all] --trusted-host pypi.org --trusted-host files.pythonhosted.org
  ./venv/bin/pip install --quiet 'hindsight-client>=0.4.22' --trusted-host pypi.org --trusted-host files.pythonhosted.org
"
```

The `hermes-agent[all]` editable install is what lets the WebUI's `/api/chat`, `/api/sessions`, and `/api/profiles` endpoints work — they import `hermes_cli.*` modules from the agent source tree.

> **Container-only deps** like `hindsight-client` and the optional `edge-tts` are listed at the top of the upstream `requirements.txt` as notes; the WebUI gracefully 503s when they're missing. You can skip the `edge-tts` line — it's only needed for the Microsoft neural-voice engine.

### 3. Write the secrets file

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

The systemd unit's `EnvironmentFile=-` directive makes systemd warn (not fail) if the file is unreadable; if your host's user separation makes the file unreadable by `hermes-webui`, the upstream's own env-file path takes over (`~/.hermes-webui/.env`). The cleaner option: make the env file readable by the unit's user — `chmod 0640 /opt/cortexos/.secrets/hermes-webui.env` is sufficient for `hermes-webui` to read it.

### 4. State dir + workspace dir + system user

The upstream's `server.py` writes session data, settings, the model cache, and the per-session workspace to a state dir. On this layout we use `/var/lib/hermes-webui` (already used by the legacy Docker install) and put the default workspace under it.

```bash
# State dir — must be writable by the systemd unit's user
sudo install -d -m 0755 -o hermes-webui -g hermes-webui /var/lib/hermes-webui
sudo install -d -m 0755 -o hermes-webui -g hermes-webui /var/lib/hermes-webui/workspace

# If the systemd user `hermes-webui` does not exist yet (uid/gid 993/980 on the standard install):
if ! getent passwd hermes-webui >/dev/null; then
  sudo useradd --system --uid 993 --gid 980 --home /home/hermes-webui --shell /bin/bash hermes-webui
fi
# Ensure the user can reach the Hermes agent home (only needed when the WebUI
# needs to list profiles from the host's ~/.hermes). Without these bits the
# user can still run, but /api/profiles returns only the root default.
sudo chmod o+rx /home/cortexos
sudo chmod -R o+rX /home/cortexos/.hermes
```

> The chmods on `/home/cortexos` are an internalization trade-off: the WebUI's containerized install used a bind mount to escape this. With a host install we just open the world-readable bits on the agent home. The WebUI's own threat model treats anything reachable on :18787 as fully trusted (auth-gated or Tailscale-only), so this is in scope. If you need stricter separation, replace the chmods with a dedicated `hermes-webui-r` group that owns `~/.hermes/`, then add `hermes-webui` to that group.

### 5. systemd unit (rendered from committed template)

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
sudo systemctl show hermes-webui.service -p WorkingDirectory,ExecStart
# Expected: WorkingDirectory=/opt/cortexos/hermes-webui
#           ExecStart=/opt/cortexos/hermes-webui/venv/bin/python3 /opt/cortexos/hermes-webui/server.py
```

The render script discovers the repo root from its own path and defaults
`CORTEX_ROOT` to that — pass `CORTEX_ROOT=/opt/cortexos` explicitly if
the repo lives there (the production layout, per the audit-fixes W52
follow-up). Do NOT hand-edit the rendered unit at
`/etc/systemd/system/hermes-webui.service` — re-run the render script
on any change.

The unit is `Type=simple` + `Restart=always` (5s backoff) — the long-running `python3 server.py` is the supervised process. No `RemainAfterExit` is needed because the work is the process itself, not a one-shot `docker compose up`.

### 6. Caddy reverse-proxy snippet (optional)

Tailscale Serve already fronts `https://cortexos.tailfd052e.ts.net:18787` → `127.0.0.1:18787`, so the WebUI is reachable on the tailnet without Caddy. If you want a second entry point under the Caddy-managed `https://cortexos.tailfd052e.ts.net/hermes/`, append to the existing Caddyfile (do **not** rewrite the file — the existing routes for the dashboard, 9Router, etc. must survive):

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

### 7. Verify

```bash
# Health (loopback)
curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/health | jq

# Profile list (verifies the agent home is reachable + the resolver works)
curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/api/profiles | jq '.profiles[].name'

# SPA shell via Tailscale
curl -fsS "https://cortexos.tailfd052e.ts.net:18787/" | head -3
```

Expected: the health endpoint returns `{"status":"ok",...}` with HTTP 200, the profile list contains at least `default` plus any named profiles (e.g. `cortex` if you set up the `cortex` profile per the hermes-profile prompt), and the SPA shell returns the upstream's HTML with HTTP 200.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/health` return 200 JSON **and** `curl -fsS http://127.0.0.1:${HERMES_WEBUI_BIND_PORT}/api/profiles` list `default` (and any named profiles)?

Type `confirmed` to proceed.

## Onboarding gate (when auth is off)

The upstream's onboarding endpoints (`/api/onboarding/oauth/start`, `/api/onboarding/setup`, etc.) are gated to loopback/private networks by default — when the WebUI has `HERMES_WEBUI_PASSWORD=` empty (auth off), a remote operator (e.g. over Tailscale) gets a 403 with the message:

> Onboarding is only available from local networks when auth is not enabled. To bypass this on a remote server, set `HERMES_WEBUI_ONBOARDING_OPEN=1`.

To allow the onboarding flow from a non-loopback client, add this to `/opt/cortexos/.secrets/hermes-webui.env` and re-render + restart the unit:

```
HERMES_WEBUI_ONBOARDING_OPEN=1
```

Re-render the unit and restart:

```bash
sudo bash scripts/ops/cortex-render-units.sh hermes-webui.service
sudo systemctl restart hermes-webui.service
```

The flag is opt-in: it's a security boundary that says "I trust the network path to the WebUI even though it has no password" (e.g. firewall + Tailscale). Don't enable it on a publicly-exposed WebUI.

## Per-profile install on Incus (optional sub-section)

If `HERMES_WEBUI_PER_PROFILE=yes`, the install hook for each existing Incus instance lives in `prompts/tools/60-incus-project.md` step 6 ("Per-profile Hermes Web UI"). The pattern mirrors the existing `hermes-gateway-<profile>.service`:

- Inside each Incus instance, run this same prompt to install the WebUI as a systemd unit (not Docker).
- Per-profile systemd unit name: `hermes-webui-<profile>.service`, bound to a per-profile loopback port (e.g. `8933` to avoid colliding with the Hermes runtime on `8932`).
- Caddy in the Incus instance routes `/hermes/<profile>/*` to the per-profile port.

The detailed step-by-step is in `60-incus-project.md` so the install order stays flat; do not duplicate the steps here.

## Legacy Docker path (kept for rollback only)

> Skip this section unless you have a pre-existing Docker-based install you want to keep.

The legacy install used `docker compose up -d` inside a one-shot `hermes-webui.service` unit, with the upstream's `c82fbd…` image and a `hermeswebui` runtime user. It still works — the unit is in the repo at `templates/systemd/hermes-webui-docker.service` if you need to roll back. To install the Docker path:

```bash
docker pull ghcr.io/nesquena/hermes-webui:${HERMES_WEBUI_VERSION}
sudo install -d "${HERMES_WEBUI_INSTALL_PATH}"
sudo tee "${HERMES_WEBUI_INSTALL_PATH}/docker-compose.yml" >/dev/null <<'YAML'
services:
  hermes-webui:
    image: ghcr.io/nesquena/hermes-webui:${HERMES_WEBUI_VERSION}
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
# Then use the docker-based unit template (one-shot + RemainAfterExit).
```

If you switch from systemd back to Docker, the systemd unit at `/etc/systemd/system/hermes-webui.service` will conflict on the same name — disable it first (`sudo systemctl disable --now hermes-webui.service`) before installing the Docker-based unit with the same name.

## Next

→ `prompts/tools/30b-fzf.md` (install fzf on the host; the per-profile step is in `60-incus-project.md`)

→ If `HERMES_WEBUI_PER_PROFILE=yes`, run `prompts/tools/60-incus-project.md` step 6 on every existing Incus instance.

→ `prompts/tools/30c-boxbox.md` (host-only file manager; per-profile install is **not** part of the brief)
