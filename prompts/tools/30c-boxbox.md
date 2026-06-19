# BoxBox (jR4dh3y/BoxBox) — host-only file manager

## Purpose

Install the upstream [jR4dh3y/BoxBox](https://github.com/jR4dh3y/BoxBox) file manager on the **host only** (per the user's brief — "I want to be part of the machine"). BoxBox is a single-binary Go web app with a SvelteKit front end, JWT auth, real-time WebSocket updates, and a chunked-resumable upload pipeline. On CortexOS it runs as a dedicated unprivileged OS user (`cortexos-files`) and is reverse-proxied through Caddy at `/files/*` with **HTTP Basic auth** — BoxBox's own JWT auth is **not** exposed to the network.

Upstream research baseline (commit `416a38a`, branch `research/hermes-webui-boxbox`) set two non-negotiable security conditions: **always front BoxBox with Caddy + Tailscale Serve, and use per-user `FM_USERS_<name>` env vars, not the YAML `users:` map** (the YAML map is plaintext and leaks via `docker inspect`).

> **No fallback in use.** The research compared BoxBox against `filebrowser` and other maintained single-binary file managers and concluded BoxBox's real-time WebSocket + Monaco editor + chunked-resumable-upload surface is the right fit. This prompt does **not** implement a fallback; if BoxBox upstream is abandoned, file an issue and re-cut the plan.

## Prerequisites

- `10-os-hardening.md` completed.
- `11-docker.md` completed (Docker is the recommended install path).
- `13-caddy.md` completed (Caddy will route `/files/*` to BoxBox + enforce basicauth).
- `12-tailscale-serve.md` completed if you plan to expose the file manager to the tailnet.

## Install surface

The **production path** is the upstream Docker image at `ghcr.io/jr4dh3y/boxbox:v0.1.4` (pin to release tag, not `latest`). The `docker-compose.yml` from the upstream repo is a near-drop-in for the CortexOS pattern; we wrap it in a systemd unit for lifecycle management.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
if [ "$(pkg_family)" = "unknown" ]; then
    echo "WARNING: OS family not detected. Run prompts/os/00-os-selection.md first."
fi
```

## Sudo gate

This spoke runs `sudo` (creates the `cortexos-files` user, installs the systemd unit, writes the Caddy config). Authenticate **now**:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used.

## Ask user

| Field | Default | Example |
| --- | --- | --- |
| Install path on host (CORTEX_ROOT + relative) | `/opt/cortexos/boxbox` | `/opt/cortexos/boxbox` |
| BoxBox bind port (loopback only) | `8200` | `8200` |
| Caddy public path | `/files/` | `/files/` |
| BoxBox root (the directory BoxBox can read/write) | `/opt/cortexos-data/files-workspace` | `/opt/cortexos-data/files-workspace` |
| Mirror PAM groups as BoxBox users? | `yes` | `yes` |

```bash
read -p "Install path [${BOXBOX_INSTALL_PATH:-/opt/cortexos/boxbox}]: " _p
BOXBOX_INSTALL_PATH="${_p:-/opt/cortexos/boxbox}"
read -p "Bind port [${BOXBOX_BIND_PORT:-8200}]: " _bp
BOXBOX_BIND_PORT="${_bp:-8200}"
read -p "Caddy public path [${BOXBOX_PUBLIC_PATH:-/files/}]: " _pp
BOXBOX_PUBLIC_PATH="${_pp:-/files/}"
read -p "BoxBox root [${BOXBOX_ROOT:-/opt/cortexos-data/files-workspace}]: " _r
BOXBOX_ROOT="${_r:-/opt/cortexos-data/files-workspace}"
read -p "Mirror PAM groups cortexos-admin + cortexos-users as BoxBox users? (yes/no) [yes]: " _mirror
BOXBOX_MIRROR_PAM="${_mirror:-yes}"
export BOXBOX_INSTALL_PATH BOXBOX_BIND_PORT BOXBOX_PUBLIC_PATH BOXBOX_ROOT BOXBOX_MIRROR_PAM
```

## Todo

- [ ] CHECKPOINT 1 confirmed — `${BOXBOX_INSTALL_PATH}` does not exist; `${BOXBOX_ROOT}` does not exist or is empty
- [ ] `pkg_install apache2-utils` (for `htpasswd`)
- [ ] Create OS user `cortexos-files` with no shell, no home dir, primary group `cortexos-files`
- [ ] `install -d -m 0750 -o cortexos-files -g cortexos-files ${BOXBOX_ROOT}`
- [ ] Pull image `ghcr.io/jr4dh3y/boxbox:v0.1.4` (pin to release tag)
- [ ] Generate `FM_JWT_SECRET` with a real CSPRNG, store in `/opt/cortexos/.secrets/boxbox.env` (mode 0600)
- [ ] Generate one strong password per PAM group, store in `/opt/cortexos/.secrets/boxbox.env` as `FM_USERS_<name>`
- [ ] Generate `/etc/caddy/boxbox-users.htpasswd` (mode 0640, group `caddy`) with the same per-group credentials
- [ ] Write `${BOXBOX_INSTALL_PATH}/docker-compose.yml`
- [ ] Write `templates/systemd/boxbox.service` (with `{CORTEX_ROOT}` placeholders) and render via `scripts/ops/cortex-render-units.sh`
- [ ] Add Caddy reverse-proxy snippet for `${BOXBOX_PUBLIC_PATH}` with `basicauth`
- [ ] `systemctl reload caddy` and `curl -fsS -u admin:<pw> http://127.0.0.1:${BOXBOX_BIND_PORT}/health` returns 200
- [ ] CHECKPOINT 2 confirmed — health 200, `curl -u admin:<pw> http://<host>/${BOXBOX_PUBLIC_PATH}` returns SPA shell

## CHECKPOINT 1

**STOP — operator question:** Are `${BOXBOX_INSTALL_PATH}` and `${BOXBOX_ROOT}` both non-existent or empty, and is the apt repo configured per `11-docker.md` + `13-caddy.md`?

```bash
test ! -e "${BOXBOX_INSTALL_PATH}" -o -z "$(ls -A ${BOXBOX_INSTALL_PATH} 2>/dev/null)"
test ! -e "${BOXBOX_ROOT}" -o -z "$(ls -A ${BOXBOX_ROOT} 2>/dev/null)"
test -x /usr/bin/docker
test -x /usr/bin/caddy
```

Type `confirmed` to proceed.

## Install (host)

### 1. `htpasswd` tool

```bash
pkg_install apache2-utils
```

We use `htpasswd -B -b` (bcrypt) to seed the Caddy basicauth file. The per-group BoxBox passwords are **separate** from the Caddy basicauth passwords — they are dual credentials (Caddy enforces first, BoxBox enforces second).

### 2. Create the unprivileged OS user

```bash
if ! id cortexos-files >/dev/null 2>&1; then
  sudo groupadd --system cortexos-files
  sudo useradd  --system \
                --gid cortexos-files \
                --home-dir "${BOXBOX_ROOT}" \
                --no-create-home \
                --shell /usr/sbin/nologin \
                --comment "BoxBox file manager (no interactive login)" \
                cortexos-files
fi
```

The `--shell /usr/sbin/nologin` prevents interactive SSH login. The user owns `${BOXBOX_ROOT}` so BoxBox can read+write it.

### 3. Create the workspace directory

```bash
sudo install -d -m 0750 -o cortexos-files -g cortexos-files "${BOXBOX_ROOT}"
```

### 4. Pull the image

```bash
docker pull ghcr.io/jr4dh3y/boxbox:v0.1.4
```

### 5. Generate the secrets file

```bash
sudo install -d -m 0700 -o root -g root /opt/cortexos/.secrets

# FM_JWT_SECRET — 64 bytes from /dev/urandom, base64
FM_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Per-group BoxBox passwords — 24 chars from /dev/urandom
FM_USERS_ADMIN=$(openssl rand -base64 24 | tr -d '\n')
FM_USERS_USERS=$(openssl rand -base64 24 | tr -d '\n')

# Caddy basicauth file — same passwords, bcrypt-hashed
sudo install -d -m 0750 -o root -g caddy /etc/caddy
sudo touch /etc/caddy/boxbox-users.htpasswd
sudo chmod 0640 /etc/caddy/boxbox-users.htpasswd
sudo chown root:caddy /etc/caddy/boxbox-users.htpasswd

# Write the Caddy htpasswd entries (bcrypt, cost=10)
HTPASSWD_BASIC_ADMIN=$(htpasswd -nB -C 10 admin "${FM_USERS_ADMIN}" | cut -d: -f2-)
HTPASSWD_BASIC_USERS=$(htpasswd -nB -C 10 users "${FM_USERS_USERS}" | cut -d: -f2-)
echo "admin:${HTPASSWD_BASIC_ADMIN}" | sudo tee    /etc/caddy/boxbox-users.htpasswd >/dev/null
echo "users:${HTPASSWD_BASIC_USERS}" | sudo tee -a /etc/caddy/boxbox-users.htpasswd >/dev/null

# BoxBox env file (mode 0600, root only — never readable by the caddy group)
sudo tee /opt/cortexos/.secrets/boxbox.env >/dev/null <<EOF
# BoxBox (jR4dh3y/BoxBox) — generated by prompts/tools/30c-boxbox.md
# JWT secret for /api/v1/auth/login. CHANGE breaks all existing sessions.
FM_JWT_SECRET=${FM_JWT_SECRET}
# Per-user credentials (mirroring PAM groups cortexos-admin + cortexos-users)
FM_USERS_admin=${FM_USERS_ADMIN}
FM_USERS_users=${FM_USERS_USERS}
# Bind loopback only — Caddy terminates TLS, Tailscale Serve exposes.
FM_HOST=127.0.0.1
FM_PORT=${BOXBOX_BIND_PORT}
# Upload limits
FM_MAX_UPLOAD_MB=1024
FM_CHUNK_SIZE_MB=5
# Rate-limit
FM_RATE_LIMIT_RPS=100
EOF
sudo chmod 0600 /opt/cortexos/.secrets/boxbox.env
sudo chown root:root /opt/cortexos/.secrets/boxbox.env
```

> **Note on plaintext credentials.** BoxBox's `internal/service/auth.go:107` compares passwords as plaintext against the in-memory map. Acceptable for v1 homelab operator-only deployments; **file an upstream issue requesting bcrypt/argon2** before exposing BoxBox to a multi-user environment. The Caddy basicauth layer in front of BoxBox does **not** mitigate this — once past Caddy, the credentials are still plaintext in the BoxBox process memory.

> **Note on dual credentials.** The Caddy htpasswd file uses **bcrypt**; the BoxBox env vars are **plaintext**. The operator logs in twice in effect: Caddy asks for `admin:<htpasswd-pw>`, then BoxBox asks for `admin:<env-pw>`. Keep a copy of both passwords in your password manager — losing them means re-running this prompt and rotating the htpasswd.

### 6. docker-compose wrapper

```bash
sudo install -d "${BOXBOX_INSTALL_PATH}"
sudo tee "${BOXBOX_INSTALL_PATH}/docker-compose.yml" >/dev/null <<'YAML'
services:
  boxbox:
    image: ghcr.io/jr4dh3y/boxbox:v0.1.4
    container_name: boxbox
    restart: unless-stopped
    env_file:
      - /opt/cortexos/.secrets/boxbox.env
    # Bind loopback only — 127.0.0.1:8200:8200 keeps the host firewall in front
    # as a second-line guard against accidental 0.0.0.0 binds on a refactor.
    ports:
      - "127.0.0.1:8200:8200"
    volumes:
      - ${BOXBOX_ROOT}:${BOXBOX_ROOT}:rw
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:8200/health"]
      interval: 30s
      timeout: 3s
      retries: 3
YAML
```

The host's `${BOXBOX_ROOT}` is bind-mounted to the same path inside the container — BoxBox reads the path verbatim from the JWT + mount config, so the path must be identical on both sides.

### 7. systemd unit (rendered from committed template)

The unit template is committed at `templates/systemd/boxbox.service`
(per the W61 convention — matching `cortex-dashboard.service` which
is also committed under `templates/systemd/`). Use the existing
render flow to substitute `{CORTEX_ROOT}` and `{CORTEX_SECRETS_DIR}`
from the template into the live `/etc/systemd/system/` tree:

```bash
# 1. Render the template (substitutes the placeholders)
sudo bash scripts/ops/cortex-render-units.sh boxbox.service

# 2. Reload systemd, enable + start
sudo systemctl daemon-reload
sudo systemctl enable --now boxbox.service

# 3. Verify the rendered unit (User + WorkingDirectory must be correct)
sudo systemctl show boxbox.service -p User -p WorkingDirectory -p EnvironmentFile
# Expected:
#   User=cortexos-files
#   WorkingDirectory=/opt/cortexos/boxbox
#   EnvironmentFile=/opt/cortexos/.secrets/boxbox.env
```

The render script defaults `CORTEX_ROOT` to the repo root it discovers
from its own path — pass `CORTEX_ROOT=/opt/cortexos` explicitly if
the repo lives there (the production layout, per the audit-fixes W52
follow-up). Do NOT hand-edit the rendered unit at
`/etc/systemd/system/boxbox.service` — re-run the render script on
any change.

The template body (the canonical source) is at
`templates/systemd/boxbox.service` in this repo. It runs the docker
compose wrapper as `User=cortexos-files Group=cortexos-files` so
even a container escape lands in a process that cannot read
`/etc/shadow` or other system files. Read the template before
modifying; the `User`/`Group` directives are load-bearing for the
least-privilege posture.

### 8. Caddy reverse-proxy snippet (with basicauth)

Append to the existing Caddyfile. The `basicauth` directive **must** be inside the `handle_path` block — it is the security control that compensates for BoxBox's plaintext credential storage:

```caddyfile
# BoxBox file manager (loopback only; Caddy enforces basicauth + TLS)
handle_path ${BOXBOX_PUBLIC_PATH}* {
    basicauth {
        user_jwt_file {
            users {
                # htpasswd-bcrypt entries; one operator per PAM group
                # the operator sees TWO login prompts: Caddy (this), then BoxBox
            }
        }
        # OR the simpler form (one htpasswd file):
        # Note: Caddyfile's `basicauth` reads a single htpasswd file via the
        # `htpasswd` directive (see Caddy docs). The dual-credential flow is:
        #   1. Browser sends Basic: admin:<htpasswd-pw>  → Caddy validates
        #   2. Caddy proxies with Authorization header preserved → BoxBox
        #      also sees the same header but the BoxBox env vars use a
        #      different password. The operator must enter the BoxBox env
        #      password on the BoxBox login form inside the SPA.
        htpasswd_file /etc/caddy/boxbox-users.htpasswd
    }
    reverse_proxy 127.0.0.1:${BOXBOX_BIND_PORT} {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

> **The htpasswd + BoxBox env dual-credential model is the current compromise** while upstream migrates to bcrypt. If a future BoxBox release lands bcrypt-hashed credential verification, switch the BoxBox env vars to bcrypt hashes (the Caddy htpasswd file becomes the single source of truth).

Reload Caddy:

```bash
sudo systemctl reload caddy
```

### 9. Verify

```bash
# Health (loopback, no basicauth challenge on this path)
curl -fsS http://127.0.0.1:${BOXBOX_BIND_PORT}/health | jq

# Login (BoxBox's own auth, after the Caddy basicauth prompt when going
# through the public path)
curl -sS -X POST http://127.0.0.1:${BOXBOX_BIND_PORT}/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"'"${FM_USERS_ADMIN}"'"}' | jq
```

Expected: health returns `{"status":"ok"}`; the login returns a JWT (`{"accessToken":"...","refreshToken":"...","expiresAt":"..."}`) for valid credentials and 401 for invalid ones.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -fsS http://127.0.0.1:${BOXBOX_BIND_PORT}/health` return 200 **and** did the BoxBox `/api/v1/auth/login` endpoint return a JWT for the `admin` user with the password in `/opt/cortexos/.secrets/boxbox.env`?

Type `confirmed` to proceed.

## Mount-point security

BoxBox's mount-point guard (`internal/middleware/security.go:60-110`) is real and enforced server-side — a URL like `/api/v1/files/?path=/etc/passwd` is normalized to the configured mount root, not the requested path. Even so, the principle of least privilege applies:

- `BOXBOX_ROOT` should be a fresh workspace (default `/opt/cortexos-data/files-workspace`) — **not** the host `/var` or `/etc`.
- Add additional read-only mounts by passing them as a second volume in the docker-compose wrapper if you need to browse the rest of the host, but **prefer not to**.
- The `cortexos-files` OS user has no shell and no home dir outside `${BOXBOX_ROOT}`; even a container escape would land in a process that cannot read `/etc/shadow` or other system files.

## Follow-up issues (file upstream)

The research flagged three BoxBox issues to track:

1. **Plaintext password storage in memory** (`backend/internal/service/auth.go:107`). File: request bcrypt or argon2id hashing with a per-user salt. Workaround: do not expose BoxBox to multi-user environments.
2. **README claims bcrypt, code uses plaintext.** The discrepancy is real and the docs-vs-code drift is worth flagging. Workaround: see #1.
3. **No built-in HTTPS.** The Caddy + Tailscale Serve layering in this prompt is the workaround; flag a request for `autocert` support.

## Next

→ `prompts/tools/30d-herdr.md` (agent terminal workspace manager) is next in the developer-experience chain.

→ Update `docs/APPS.md` Shipped section to list `BoxBox` as a new entry. The current `docs/APPS.md` (post-audit-fixes W56) has a Shipped/Planned split — the new tool belongs in Shipped once this prompt is in the install order.

→ Add a `BoxBox` tile to the dashboard's `/apps` page. The seed row is in `packages/dashboard-next/migrations/009_hermes_webui_boxbox_seed.sql` (Track A of this plan).
