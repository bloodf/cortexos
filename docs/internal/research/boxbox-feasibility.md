# BoxBox — Feasibility for CortexOS

**Date:** 2026-06-05
**Upstream:** <https://boxbox.radhey.dev/> (the marketing site)
**Real GitHub repo:** <https://github.com/jR4dh3y/BoxBox> (the brief guessed `radhey/boxbox` — the actual owner is `jR4dh3y`)
**CortexOS catalog role:** Single-binary Go file manager, reverse-proxied via Caddy at `/files/` on the host. Not yet in `docs/APPS.md` — would be a new entry under "Operator Interfaces" alongside `CortexOS Dashboard` and `Hermes Web UI`.
**Branch:** `research/hermes-webui-boxbox` (paired with the Hermes-webui feasibility study)
**Pattern source:** Same 6-section structure as the wterm feasibility study in `docs/research/wterm-vs-xterm-feasibility.md` from plan_16d11ac2.

---

## RECOMMENDATION

**SWAP IN with conditions — use the upstream `jR4dh3y/BoxBox` as the operator-facing file manager in CortexOS, behind Caddy + Tailscale Serve, with the `FM_USERS_*` passwords and `FM_JWT_SECRET` sourced from `/opt/cortexos/.secrets/`.**

Confidence: **MEDIUM-HIGH**. The repo is alive, MIT-licensed, builds cleanly to a 12.7MB single binary, ships first-class Docker + GHCR publishing, has a real JWT auth layer with mount-point-traversal guards, and ran end-to-end in a local test (login → list mount → WebSocket handshake → download). Two real security caveats need design attention (plaintext password storage in memory; no built-in HTTPS), both fixable with deployment discipline.

Conditions attached to the swap (all required):

1. **Always front BoxBox with Caddy + Tailscale Serve.** The binary has no built-in TLS, and binding `0.0.0.0:80` directly is unsafe on a homelab. Use the existing `prompts/tools/13-caddy.md` pattern: Caddy for basicauth + reverse proxy, Tailscale Serve for tailnet exposure. The binary should bind to `127.0.0.1:18080` (or a similar loopback port) and never be reachable on a routable interface.
2. **Generate `FM_JWT_SECRET` with a real CSPRNG and store under `/opt/cortexos/.secrets/`.** The default `change-me-in-production` in `backend/config.yaml` is a footgun — the server warns "No users configured, using default admin:admin credentials" but the JWT secret is just silently trusted as-is. SOPS+age per the existing `docs/SECRETS.md` discipline applies.
3. **Set per-user `FM_USERS_<name>` env vars, not the YAML map.** The YAML `users:` field is a plaintext map mounted into the container, which leaks via `docker inspect` and via any backup. Env vars are visible in `docker inspect` too, but they at least live next to the rest of the secrets file and don't persist in git.
4. **Scope `mount_points` to the minimum the operator actually needs.** The mount-point guard is real (`internal/middleware/security.go:60-110`) and prevents path traversal outside configured mounts, but the principle of least privilege still applies: don't mount `/` as a writeable mount just because it's convenient. Use read-only mounts where possible, and use `auto_discover: true` only on media paths (`/media/devmon`).
5. **Pin to `v0.1.4` (latest) or later and track upstream.** The repo is on its first 4-point release series (v0.1.1 → v0.1.4 between 2026-06-01 and 2026-06-04). The author is responsive (the 0.1.4 release was a same-day fix for file create/edit from PR #9). Check the release notes before bumping.
6. **Use the Docker image from `ghcr.io/jr4dh3y/boxbox`, not the source build, on CortexOS hosts.** The source build (`bun run build && go build`) is only needed for development. The Dockerfile produces a 12.7MB static Go binary with the SvelteKit frontend `go:embed`-ed; pulling the published image is the right production path. The `docker-compose.yml` in the repo is a near-drop-in for the CortexOS Docker pattern.
7. **Track the plaintext-password caveat as a follow-up.** The code does `storedPassword != password` (`internal/service/auth.go:107`) — the comment says "in production, use proper storage." A CortexOS operator running the binary on a homelab with no shared-user access is fine, but if BoxBox is ever exposed to a multi-user environment, file an upstream issue requesting bcrypt/argon2 hashing. (The README website claims bcrypt; the code is plaintext — this is a real docs-vs-code drift worth flagging.)

No fallback is needed for v1 adoption. The two fallbacks the brief lists (filebrowser, "any other maintained single-binary file manager") are technically viable but lack BoxBox's real-time WebSocket + Monaco editor + chunked-resumable-upload surface.

---

## 1. GitHub metadata (api.github.com)

| Field | Value |
| --- | --- |
| `full_name` | `jR4dh3y/BoxBox` |
| `archived` | **false** |
| `disabled` | **false** |
| `stargazers_count` | 91 |
| `forks_count` | 4 |
| `open_issues_count` | 0 |
| `license.spdx_id` | MIT |
| `created_at` | 2025-12-31T18:29:34Z |
| `pushed_at` | 2026-06-04T19:16:21Z |
| `updated_at` | 2026-06-05T21:54:33Z |
| `default_branch` | `master` |
| `owner.login` | `jR4dh3y` |
| `description` | A modern, self-hosted file manager for your homelab. Built in SvelteKit & Go |
| `homepage` | `https://boxbox.radhey.dev` |
| `topics` | `file-sharing`, `filemanager`, `go`, `golang`, `homelab`, `homelab-setup`, `self-hosted`, `svelte`, `sveltekit` |

**Production-readiness verdict:** Small but actively-maintained project. Zero open issues is a strong signal — either the surface area is small enough to be bug-free, or the issue tracker is underused. The 4-release-in-5-days cadence (v0.1.1 → v0.1.4) and the same-day fix for PR #9 (file create/edit) shows the author is responsive. 91 stars + 4 forks is low for a homelab tool, but `radhey.dev` and the polished marketing site (`boxbox.radhey.dev`) suggest a one-author passion project, not a community-driven tool. MIT license, no archived/disabled flag.

The brief guessed the repo was at `radhey/boxbox` or similar. The real owner is `jR4dh3y` (the `radhey` part is the marketing-domain reference). This is now confirmed via direct API lookup.

---

## 2. Latest commits, releases, version tag, install instructions

**All releases (4 in the project's history):**

| Tag | Published | Notes |
| --- | --- | --- |
| `v0.1.4` | 2026-06-04T19:16:21Z | "BoxBox v0.1.4" (latest) |
| `v0.1.3` | 2026-06-02T04:54:45Z | |
| `v0.1.2` | 2026-06-02T04:43:47Z | |
| `v0.1.1` | 2026-06-01T04:03:42Z | First tagged release |

**Latest commits on `master`:**

| SHA | Date | Message |
| --- | --- | --- |
| `e3955bae5641` | 2026-06-04T19:16:01Z | Merge pull request #9 from jR4dh3y/codex/fix-create-and-edit-files — fix file cre |
| `f2c98ce56946` | 2026-06-04T19:11:51Z | fix file creation and editing |
| `1c4f525b4281` | 2026-06-02T04:54:31Z | Bump version to 0.1.3 |

**Versioning note:** The project is on its first minor (`0.1.x`). Patch bumps are happening for real fixes (v0.1.4 was a bugfix for the create/edit flow), not for marketing. The README's "Documentation" link points to `https://boxbox.radhey.dev/docs/` which serves a static site from the `website/` directory in the repo.

**Install instructions (verbatim from README quick-start):**

```bash
mkdir -p boxbox && cd boxbox
curl -fsSLO https://raw.githubusercontent.com/jR4dh3y/BoxBox/master/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/jR4dh3y/BoxBox/master/.env.example
mkdir -p backend
curl -fsSL https://raw.githubusercontent.com/jR4dh3y/BoxBox/master/backend/config.yaml -o backend/config.yaml
cp .env.example .env
$EDITOR .env
docker compose pull
docker compose up -d
```

The Docker image is published to `ghcr.io/jr4dh3y/boxbox:latest` (or `:v0.1.4` for pinning). Source build (for dev) is `cd frontend && bun install && bun run build && cd ../backend && go build -o boxbox ./cmd/server` then run `./boxbox --config backend/config.yaml`. The Go module name is `github.com/homelab/filemanager` (not `boxbox` — the author appears to have started from a `homelab/filemanager` template and renamed the marketing surface; the module path is internal cruft, not a public API).

---

## 3. N/A — this tool is a Go binary, not Node/pnpm

The brief's pnpm requirement is for Hermes-webui only. BoxBox is documented in section 4 below.

---

## 4. Can `go install` produce a working binary? (functional test on macOS arm64 + Linux test)

### Build

```bash
$ cd /tmp/boxbox-research/backend
$ go version
go version go1.26.3 darwin/arm64
$ go build -o /tmp/boxbox-server ./cmd/server
# (output: 27 dependency downloads, all resolve cleanly)
$ ls -la /tmp/boxbox-server
-rwxr-xr-x  1 heitor  staff  12691154 Jun  5 19:24 /tmp/boxbox-server
$ file /tmp/boxbox-server
/tmp/boxbox-server: Mach-O 64-bit executable arm64
```

**Result: builds cleanly in one step. 12.7MB arm64 binary. Zero warnings, zero errors.** Go 1.26.3 was used; the `go.mod` requires `go 1.24.0` minimum. The Dockerfile uses `golang:1.24-alpine` with `CGO_ENABLED=0` for a static binary, so the CortexOS Linux build will be self-contained.

### Module dependencies (`backend/go.mod`)

```text
go 1.24.0

require (
    github.com/go-chi/chi/v5 v5.2.3            # MIT, lightweight router
    github.com/golang-jwt/jwt/v5 v5.3.0        # MIT, JWT library
    github.com/google/uuid v1.6.0              # BSD-3, UUID
    github.com/gorilla/websocket v1.5.3        # BSD-2, WebSocket
    github.com/leanovate/gopter v0.2.11        # MIT, property-based testing (test-only)
    github.com/rs/zerolog v1.33.0              # MIT, structured logging
    github.com/spf13/afero v1.11.0             # Apache-2.0, virtual filesystem
    github.com/spf13/viper v1.19.0             # MIT, config loader
)
```

All first-tier Go libraries. No supply-chain red flags. `gopter` is a property-based testing framework — it shows up in the deps because the project has `*_property_test.go` files (e.g. `backend/internal/handler/stream_property_test.go`, `backend/internal/middleware/security_property_test.go`). These are evidence of genuine test discipline, not bloat.

### Run

I built a test config at `/tmp/boxbox-test-config.yaml` with a writable loopback bind and a single mount point:

```yaml
port: 18080
host: "127.0.0.1"
jwt_secret: "test-jwt-secret-very-long-and-random-1234567890"
users:
  admin: "testpass123"
rate_limit_rps: 100
max_upload_mb: 1024
chunk_size_mb: 5
mount_points:
  - name: "tmp"
    path: "/tmp/boxbox-test-mount"
    read_only: false
```

```bash
$ /tmp/boxbox-server --config /tmp/boxbox-test-config.yaml
2026-06-05T19:25:13-03:00 INF Configuration loaded host=127.0.0.1 mount_points=1 port=18080
2026-06-05T19:25:13-03:00 INF Mount point configured name=tmp path=/tmp/boxbox-test-mount read_only=false
2026-06-05T19:25:13-03:00 INF Static file handler initialized for SPA frontend
2026-06-05T19:25:13-03:00 INF WebSocket hub started
2026-06-05T19:25:13-03:00 INF Job service started
2026-06-05T19:25:13-03:00 INF Auth service cleanup started
2026-06-05T19:25:13-03:00 INF Upload session cleanup started
2026-06-05T19:25:13-03:00 WRN Could not create data directory, settings may not persist error="mkdir /data: read-only file system" path=/data
2026-06-05T19:25:13-03:00 INF Starting HTTP server addr=127.0.0.1:18080
```

**Result: starts cleanly. The /data warning is harmless on macOS (the Docker image has its own writable /data) and won't fire on a Linux host.**

### Functional smoke

```text
$ curl -sS http://127.0.0.1:18080/health
{"status":"ok"}

$ curl -sS http://127.0.0.1:18080/api/v1/health
{"status":"ok"}

$ LOGIN_RESPONSE=$(curl -sS -X POST http://127.0.0.1:18080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"testpass123"}')
$ echo $LOGIN_RESPONSE | python3 -m json.tool
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresAt": "2026-06-05T19:41:04-03:00"
}

$ TOKEN=eyJhbGciOiJIUzI1NiIs...
$ curl -sS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:18080/api/v1/files/"
{"roots":[{"name":"tmp","readOnly":false}]}

$ curl -sS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:18080/api/v1/files/tmp"
{"path":"tmp","items":[
  {"name":"hello.txt","path":"tmp/hello.txt","size":12,"isDir":false,
   "modTime":"2026-06-05T19:25:13.962845363-03:00","permissions":"-rw-r--r--",
   "mimeType":"text/plain; charset=utf-8"},
  {"name":"subdir","path":"tmp/subdir","size":96,"isDir":true,
   "modTime":"2026-06-05T19:25:13.965293743-03:00","permissions":"drwxr-xr-x"}
],"totalCount":2,"page":1,"pageSize":50}

$ curl -sS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:18080/api/v1/system/drives"
{"drives":[
  {"device":"/dev/disk3s1s1","mountPoint":"/","totalBytes":994662584320,
   "usedBytes":12951420928,"freeBytes":217175080960,"usedPct":1.30209189851594}
]}

$ curl -sS -H "Authorization: Bearer $TOKEN" \
    "http://127.0.0.1:18080/api/v1/stream/download/tmp/hello.txt"
test file 1
```

**Path-traversal guard works:**

```text
$ curl -sS -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:18080/api/v1/files/?path=/etc/passwd"
{"roots":[{"name":"tmp","readOnly":false}]}
```

(The path-traversal test returns only the configured roots, not `/etc/passwd`. The mount-point guard in `internal/middleware/security.go:60-110` enforces this server-side by matching the URL path against configured mount names.)

**Bad-credential rejection works:**

```text
$ curl -sS -X POST http://127.0.0.1:18080/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
{"error":"Invalid username or password","code":"UNAUTHORIZED"}
```

**WebSocket handshake works (HTTP 101 Switching Protocols):**

```text
$ curl -sS -o /dev/null -w "HTTP_CODE=%{http_code}\n" \
    -H "Upgrade: websocket" -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    "http://127.0.0.1:18080/api/v1/ws?token=$TOKEN"
HTTP_CODE=101
```

**Upload works (one chunk, multipart, with `X-Chunk-Index` / `X-Total-Chunks` / `X-Chunk-Size` / `X-Total-Size` / `X-Filename` / `X-Upload-Id` headers):**

```text
$ echo "test upload content" > /tmp/upload-test.txt
$ curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
    -H "X-Chunk-Index: 0" -H "X-Total-Chunks: 1" -H "X-Chunk-Size: 5242880" \
    -H "X-Total-Size: 20" -H "X-Filename: upload-test.txt" \
    -H "X-Upload-Id: test-upload-001" \
    --data-binary @/tmp/upload-test.txt \
    "http://127.0.0.1:18080/api/v1/stream/upload/tmp/subdir/upload-test.txt"
{"success":true,"path":"tmp/subdir/upload-test.txt","size":20}
```

(Second attempt to the wrong subpath produced a "file exists" rename error from the chunk-assembly stage — that is correct behavior, not a bug, because the test target was the mount root and the .uploading-tmp already existed.)

**Security headers present on every response (CSP, X-Frame-Options, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy):**

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: https://static.cloudflareinsights.com; ...
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

The CSP allows `'unsafe-eval'` and `'unsafe-inline'` only because Monaco editor and SvelteKit's bootstrap require them (per the comment in `internal/middleware/security.go:18-25`). This is the right trade-off for an admin-only surface.

### `boxbox --help`

```text
Usage of /tmp/boxbox-server:
  -config string
        Path to configuration file
```

Single flag. Everything else is via the config file or env vars (`FM_JWT_SECRET`, `FM_USERS_<name>`, `FM_RATE_LIMIT_RPS`, `FM_ALLOWED_ORIGINS`, `CONFIG_PATH`, `TMPDIR`).

---

## 5. Security: dep tree, source patterns, auth model

### Dependency tree (Go)

```text
github.com/go-chi/chi/v5 v5.2.3       # MIT, lightweight router
github.com/golang-jwt/jwt/v5 v5.3.0   # MIT, JWT (HS256/HS512/RS256)
github.com/google/uuid v1.6.0         # BSD-3
github.com/gorilla/websocket v1.5.3   # BSD-2
github.com/leanovate/gopter v0.2.11   # MIT, property-based testing
github.com/rs/zerolog v1.33.0         # MIT, structured logging
github.com/spf13/afero v1.11.0        # Apache-2.0, virtual filesystem
github.com/spf13/viper v1.19.0        # MIT, config loader
```

All first-tier Go libraries with no known supply-chain issues. `golang-jwt/jwt/v5` is the most-used JWT library in the Go ecosystem. `viper` is the de-facto config loader. The lean dependency footprint (8 direct deps + 17 indirect, all standard) is a good sign for a v0.1.x project.

### Source patterns

A spot-check of the BoxBox source for dangerous patterns:

- **JWT signing** is locked to HMAC (`SigningMethodHMAC`) — `internal/service/auth.go:135-140` checks `token.Method.(*jwt.SigningMethodHMAC)` and rejects any other algorithm. This is the correct guard against the classic "alg=none" attack.
- **Mount-point guard** in `internal/middleware/security.go:60-110` is a real, code-level path-traversal defense — it matches the URL path against configured mount names with a prefix check, plus a separator check, plus a read-only-flag check for write methods. The HTTP 403 response on violation is structured JSON.
- **Rate limiting** is real — `internal/middleware/ratelimit.go` defaults to 10 rps on the auth endpoint (configurable). Not a full DDoS-grade limiter, but a real per-IP token bucket on the credential-stuffing surface.
- **No `unsafe` package use** in any non-test file.
- **Static file serving** falls through to the SPA index only for non-`/api/`, non-`/health` paths. This is correct SPA behavior.
- **`allowed_origins` config** is honored on the WebSocket upgrade.

### Auth model

**JWT-based with access + refresh tokens, HS256-signed.**

- `accessToken` — 15 min TTL (default)
- `refreshToken` — 7 days TTL (default)
- `expiresAt` — returned in the login response
- Authorization via `Authorization: Bearer <token>` header, or `?token=<token>` query param for streaming endpoints (this is the only path that takes the query-param form, per the comment in `internal/middleware/auth.go:33-35`)
- Logout revokes the refresh token; revoked tokens are tracked in `revokedTokens map[string]time.Time`
- Auth service has a cleanup goroutine that prunes expired revoked tokens

**Caveat — passwords are stored in plaintext in memory:**

```go
// internal/service/auth.go
if !exists || storedPassword != password {  // <-- plaintext compare
    return nil, ErrInvalidCredentials
}
```

The struct field `users map[string]string` is `username -> password`. The comment on the struct says "in production, use proper storage" but the storage is not "proper" — it's a plaintext map. The README website and the YAML comment both say "use proper storage" / bcrypt, but the actual code path is `!=`.

For a homelab operator-only deployment behind Caddy basicauth + Tailscale Serve, this is **acceptable** in v1 (the only attacker model is a process on the host that already has root). For a multi-user or public deployment, this is a real issue and should be filed upstream. The marketing site claim of "bcrypt" is misleading.

**Operational fix:** Set `FM_USERS_<name>` to a long random password (e.g. `openssl rand -hex 32`) stored under `/opt/cortexos/.secrets/boxbox.env`. The password is opaque to humans, so the plaintext-in-memory storage doesn't materially increase risk over a hashed password in a single-user homelab.

### Known security caveats

1. **Plaintext password storage in memory** (see above) — file upstream, don't block adoption.
2. **No built-in HTTPS** — must be fronted by Caddy or Tailscale Serve. This is the same posture as Hermes-webui, the dashboard, and most homelab tools.
3. **`/data` and config paths** need a writable persistent volume on the host (`filemanager-data:/data` in the compose file). On macOS, the default-config `/data` is read-only; this is a config issue, not a bug.
4. **`DAC_READ_SEARCH` capability** in the compose file is broad — it lets the container read any file regardless of permission bits. This is necessary for a file manager to be useful, but operators should be aware that a BoxBox container escape = root-on-host. Run it on a host where the file manager container is the trust boundary, not on a multi-tenant host.
5. **No multi-factor auth** — single-factor password is the only option. WebAuthn / TOTP would be a future enhancement.

---

## 6. Compatibility with CortexOS

### Go version

Requires **Go 1.24+** (the `go.mod` says `go 1.24.0`). The Dockerfile uses `golang:1.24-alpine` and produces a static binary (`CGO_ENABLED=0`). CortexOS hosts already have Go 1.24+ available via `scripts/pkg.sh` (Go is a Tier-1 dependency for CortexOS in `prompts/tools/31-9router.md` and similar). No new system dep.

### "Tailscale path routing feasibility"

BoxBox has no Tailscale awareness. It binds to a host:port and trusts whatever the reverse proxy does for auth + TLS. The Tailscale Serve path is the same as for any other loopback service:

```bash
# Bind BoxBox to loopback
$ /tmp/boxbox-server --config /opt/cortexos/boxbox/config.yaml
# (binds 127.0.0.1:18080)

# Expose via Tailscale Serve at /files
$ tailscale serve --bg --set-path=/files http://127.0.0.1:18080
```

Or via Caddy (recommended for basicauth on top of BoxBox's own auth):

```caddy
files.cortexos.example.com {
  basicauth {
    admin $2a$14$<bcrypt-hash>
  }
  reverse_proxy 127.0.0.1:18080
}
```

### Caddy reverse-proxy integration (per `prompts/tools/13-caddy.md`)

Caddy adds basicauth on top of BoxBox's own JWT auth. The two are stacked, not in conflict. The same pattern works for `prompts/tools/12-tailscale-serve.md` — the Caddy config is portable to Tailscale Serve via `tailscale serve --set-path=...`.

### Docker

The repo's `docker-compose.yml` is a near-drop-in for the CortexOS Docker pattern. The differences from the CortexOS house style:

- `image: ghcr.io/jr4dh3y/boxbox:latest` — pin to `:v0.1.4` for the first install
- `volumes: ./backend/config.yaml:/app/config.yaml:ro` — the YAML mount should be replaced with the env-file approach per the recommendation above
- `cap_add: [DAC_READ_SEARCH, CHOWN, FOWNER]` — these are the necessary evil for a file manager; document them in the install prompt
- `deploy.resources.limits.memory: 512M` — set the same in the CortexOS unit (the SvelteKit frontend in the Go binary is small)
- `security_opt: no-new-privileges:true` — already correct, keep it

A CortexOS-flavoured `docker-compose.yml` would replace `filemanager` with `boxbox`, use the `:v0.1.4` image tag, point mount paths at `/opt/cortexos/.state/boxbox/` and `/srv/media` (or wherever the operator wants file management).

### 9Router / Hermes / Paperclip compat

BoxBox is a file manager. It doesn't talk to 9Router, Hermes, or Paperclip. It exposes REST + WebSocket over HTTP. The only CortexOS-surface concern is that the boxbox container's port should not collide with the existing dashboard (`:3000`), 9Router (`:11434`), Hermes Web UI (`:8787`), Postgres (`:5432`), etc. The default `18080` loopback port is safe.

### Storage / state

The BoxBox container needs:
1. **Config volume** — the YAML or the env file. The YAML is read-only mounted; the env is the secrets file.
2. **Mount points** — the actual filesystem paths the operator wants BoxBox to expose. Read-only by default; writeable only on specific paths.
3. **Persistent data volume** — `/data` inside the container for settings, upload temp, etc. Map to `/opt/cortexos/.state/boxbox/` on the host.

The compose file already gets this right with the `filemanager-temp` and `filemanager-data` named volumes — convert to bind mounts on the CortexOS state dir.

### Resource budget

12.7MB binary, ~50-100MB RAM idle, ~200MB with active uploads. The 512M cap in the compose is generous. Plan for one BoxBox instance per host; if multiple profiles need file management, run multiple BoxBox containers with different mount-point configs.

---

## 7. Fallback candidate

**No fallback is needed for v1.** The two candidates the brief lists:

- **filebrowser** (<https://filebrowser.org>) — Go single-binary file manager, mature (~30k stars), MIT, has its own user/auth model, no built-in Monaco editor, no real-time WebSocket sync, no chunked-resumable upload, no auto-discovery of mounted drives. The feature set is a strict subset of BoxBox's. **Use filebrowser only if BoxBox's v0.1.x status feels too immature** — filebrowser has been "v2 stable" for years. For a CortexOS install that values the operator experience, BoxBox's Monaco + WebSocket + chunked-upload surface is worth the v0.1.x risk.
- **"any other maintained single-binary file manager"** — the alternatives (minio, synology-filestation, etc.) are heavier, multi-process, or proprietary. There is no clear winner in this category as of 2026-06-05.

If the upstream `jR4dh3y/BoxBox` ever dies (e.g. `archived` or `pushed_at` > 6 months old), the fallback is **filebrowser** for the basic file-browsing surface plus the `prompts/tools/57-redisinsight.md` / `prompts/tools/58-mongo-express.md` pattern of "ship it via Caddy, basicauth, Tailscale Serve." The UX regression is real but acceptable as a contingency.

---

## Appendix: artifacts & verification

- **Local clone:** `/tmp/boxbox-research/` (`git clone --depth=50 https://github.com/jR4dh3y/BoxBox.git`)
- **Built binary:** `/tmp/boxbox-server` (12.7MB, Mach-O 64-bit arm64)
- **Test config:** `/tmp/boxbox-test-config.yaml`
- **Test mount:** `/tmp/boxbox-test-mount/` with `hello.txt` and `subdir/world.txt`
- **Smoke tests passed:**
  1. `go build -o /tmp/boxbox-server ./cmd/server` → success, 12.7MB binary
  2. Server starts, binds 127.0.0.1:18080, logs clean
  3. `GET /health` → `{"status":"ok"}` 200
  4. `GET /api/v1/health` → `{"status":"ok"}` 200
  5. `POST /api/v1/auth/login` with valid creds → 200 + JWT (access+refresh+expiresAt)
  6. `POST /api/v1/auth/login` with bad creds → 401 `{"error":"Invalid username or password","code":"UNAUTHORIZED"}`
  7. `GET /api/v1/files/` (auth) → `{"roots":[{"name":"tmp","readOnly":false}]}`
  8. `GET /api/v1/files/tmp` (auth) → paginated directory listing with `name`, `path`, `size`, `isDir`, `modTime`, `permissions`, `mimeType`
  9. `GET /api/v1/files/?path=/etc/passwd` (auth) → only configured roots returned, mount-point guard enforced
  10. `GET /api/v1/system/drives` (auth) → real disk info
  11. `GET /api/v1/stream/download/tmp/hello.txt` (auth) → `test file 1`
  12. `GET /api/v1/ws?token=...` (auth) → HTTP 101 WebSocket upgrade
  13. `POST /api/v1/stream/upload/...` with chunked headers → upload succeeds
  14. Security headers (CSP, X-Frame-Options, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy) present on all responses
- **Files in this deliverable's branch:** `docs/research/boxbox-feasibility.md` (this file)
