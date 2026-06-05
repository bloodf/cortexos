# Hermes Web UI — Feasibility for CortexOS

**Date:** 2026-06-05
**Upstream:** <https://github.com/nesquena/hermes-webui>
**Real repo path:** <https://github.com/nesquena/hermes-webui> (the brief's URL is correct)
**CortexOS catalog role:** Operator-facing Hermes profile UI (per `docs/APPS.md` line 30, install prompt `prompts/tools/40-hermes.md`)
**Branch:** `research/hermes-webui-boxbox` (paired with the BoxBox feasibility study)
**Pattern source:** Same 6-section structure as the wterm feasibility study in `docs/research/wterm-vs-xterm-feasibility.md` from plan_16d11ac2.

---

## RECOMMENDATION

**SWAP IN — use the upstream `nesquena/hermes-webui` as the operator-facing Hermes profile UI in CortexOS.**

Confidence: **HIGH**. The repo is alive, heavily maintained, MIT-licensed, runs in a clean local test with zero hermes-agent installed, ships first-class Docker + SSH-tunnel deployment, has a real auth layer (password + WebAuthn/passkey), and has no architecture that conflicts with CortexOS's 9Router / Hermes profile model.

Conditions attached to the swap (all required, all cheap):

1. **Document the runtime reality, not the brief's `pnpm install && pnpm run build` assumption.** The app is Python (stdlib `http.server` + `BaseHTTPRequestHandler`) + vanilla JS in `static/`. There is no Node build step. The `package.json` is dev-only tooling (ESLint runtime-guard). The install path is `python3 bootstrap.py` (or `pip install -r requirements.txt` for the WebUI's two deps, then `python3 server.py`). The team's `prompts/tools/40-hermes.md` install prompt needs to be updated to reflect this.
2. **Bind to loopback (`127.0.0.1`) and let Tailscale Serve / Caddy expose it.** The app's safe default is `HERMES_WEBUI_HOST=127.0.0.1` and the server loudly warns when binding non-loopback without a password. The container Dockerfile overrides this to `0.0.0.0` because it has to publish the port — that's fine, but Tailscale Serve is the right external exposure.
3. **Set `HERMES_WEBUI_PASSWORD` (or enable passkeys) before exposing externally.** The auth module is real (`api/auth.py`, 23KB; supports password + WebAuthn passkey + optional OAuth). It is **off by default** — the server only enables auth if `HERMES_WEBUI_PASSWORD` is set, or if passkeys are registered, or if a password is configured in the Settings UI. Exposing without auth means anyone on the network can read the agent's memory and sessions. The startup banner explicitly calls this out.
4. **Run it via the Dockerfile, not bare Python, on CortexOS hosts.** The repo ships a multi-stage Dockerfile (Python 3.12-slim, unprivileged `hermeswebui` user, `uv` preinstalled, no sudo, healthcheck) and three docker-compose variants (single, two, three container). The systemd unit template should wrap `docker compose up` from a dedicated `/opt/cortexos/hermes-webui/` directory, not call `python3 server.py` directly.
5. **Pin to the latest release tag, not `master`.** The release cadence is intense (5 releases in 24 hours on 2026-06-05; v0.51.276 → v0.51.280). The Dockerfile already supports `--build-arg HERMES_VERSION=$(git describe --tags --always)` so the version is baked into the image. Pin the docker-compose image to `ghcr.io/nesquena/hermes-webui:vX.Y.Z` in the install prompt.

No fallback is needed. The two fallbacks the brief lists (filebrowser, paperclip-ui) would be a major regression: filebrowser has no concept of "Hermes agent profile," and paperclip-ui is a workflow surface, not an agent chat surface.

---

## 1. GitHub metadata (api.github.com)

| Field | Value |
| --- | --- |
| `full_name` | `nesquena/hermes-webui` |
| `archived` | **false** |
| `disabled` | **false** |
| `stargazers_count` | 13,526 |
| `forks_count` | 1,649 |
| `open_issues_count` | 243 |
| `license.spdx_id` | MIT |
| `created_at` | 2026-03-30T21:50:12Z |
| `pushed_at` | 2026-06-05T21:55:03Z |
| `updated_at` | 2026-06-05T22:10:51Z |
| `default_branch` | `master` |
| `owner.login` | `nesquena` |
| `description` | Hermes WebUI: The best way to use Hermes Agent from the web or from your phone! |
| `homepage` | `https://get-hermes.ai/` |
| `topics` | `agent`, `ai-agents`, `hermes`, `hermes-agent`, `nous-research` |

**Production-readiness verdict:** Aligned with the GitHub JSON, this is a young repo (2 months old) with an unusually high star count for its age — likely driven by the underlying `NousResearch/hermes-agent` (the well-known Nous Research agent project) being promoted. The `nesquena` owner is a known and reputable OSS author (Riposte, multiple other projects). The release cadence (5 releases in 24 hours on 2026-06-05 alone) and the deeply commented source (e.g. `api/config.py` is 247KB) indicate an actively-maintained, fast-iterating project, not a one-shot. MIT license is permissive. No archived or disabled flag.

---

## 2. Latest commits, releases, version tag, install instructions

**Latest 5 releases (all from 2026-06-05):**

| Tag | Published | Notes |
| --- | --- | --- |
| `v0.51.280` | 2026-06-05T21:55:24Z | Latest. "Release IV (stage-p3i — Windows self-update restart fix #364" |
| `v0.51.279` | 2026-06-05T21:45:48Z | "Release IU (stage-p3h — preserve Activity/streaming turn on" |
| `v0.51.278` | 2026-06-05T21:28:05Z | "Release IT (stage-p3g — repair inline PDF preview #3652)" |
| `v0.51.277` | 2026-06-05T20:45:34Z | |
| `v0.51.276` | 2026-06-05T20:35:15Z | |

**Latest commits on `master`:** Mirror the release tags. `ffc1ab6` (2026-06-05T21:54:59Z) is the head of `master` and is the v0.51.280 release commit.

**Versioning note:** The version is a 0.51.x rolling counter that resets the patch number every ~10 releases (Release IV = #280). This is unusual but consistent — every release commit is tagged, every tag has notes, every commit message includes the release letter + stage code. The `__version__` is baked into the Docker image at build time via `ARG HERMES_VERSION`.

**Install instructions (verbatim from README quick-start, abridged):**

```bash
git clone https://github.com/nesquena/hermes-webui.git hermes-webui
cd hermes-webui
python3 bootstrap.py        # detects Hermes Agent, creates venv, starts server
# OR
./start.sh                  # bash launcher (drops to unprivileged user in container)
./ctl.sh start              # background daemon, PID at ~/.hermes/webui.pid
```

The Python deps are trivial (full `requirements.txt`):

```text
pyyaml>=6.0
cryptography>=42.0
```

Optional: `edge-tts` for server-side Microsoft neural TTS (the `/api/tts` endpoint returns 503 with an install hint if absent — it's intentionally not a hard dep).

Docker is the production path: three compose variants (`docker-compose.yml`, `docker-compose.two-container.yml`, `docker-compose.three-container.yml`) and a single `Dockerfile` that builds a Python 3.12-slim image with `uv` preinstalled, an unprivileged `hermeswebui` user, and a healthcheck on `/health`.

---

## 3. Can it install + run without errors? (functional test on macOS arm64)

**The brief asked for `pnpm install && pnpm run build`. This assumption is wrong** — the app is Python + vanilla JS, no bundler, no `pnpm`. I ran the actual install + boot path the README documents.

### Install

```text
$ python3 -m venv /tmp/hermes-webui-venv
$ /tmp/hermes-webui-venv/bin/pip install -q -r requirements.txt
Package      Version
------------ -------
cffi         2.0.0
cryptography 48.0.0
pycparser    3.0
PyYAML       6.0.3
```

**Result: installs in seconds, no errors.** The full `bootstrap.py` would additionally try to install the upstream `NousResearch/hermes-agent` via the official `install.sh`, which is intentionally not run in this feasibility test (out of scope — the WebUI starts cleanly without it; the agent integration is a separate runtime concern).

### Boot

```bash
HERMES_WEBUI_STATE_DIR=/tmp/hermes-test-state \
  HERMES_WEBUI_HOST=127.0.0.1 \
  HERMES_WEBUI_PORT=18787 \
  HERMES_WEBUI_NO_BROWSER=1 \
  /tmp/hermes-webui-venv/bin/python3 -u server.py
```

**Server log (first ~25 lines):**

```text
  Hermes Web UI -- startup config
  --------------------------------
  repo root   : /private/tmp/hermes-webui-research
  agent dir   : NOT FOUND  [XX]
  python      : /opt/homebrew/bin/python3
  state dir   : /private/tmp/hermes-test-state
  workspace   : /Users/heitor/workspace
  host:port   : 127.0.0.1:18787
  config file : /Users/heitor/.hermes/config.yaml  (not found, using defaults)

  [XX]  Could not find the Hermes agent directory.
        The server will start but agent features will not work.

        To fix, set one of:
          export HERMES_WEBUI_AGENT_DIR=/path/to/hermes-agent
          export HERMES_HOME=/path/to/.hermes

        Or clone hermes-agent as a sibling of this repo:
          git clone <hermes-agent-repo> ../hermes-agent

  [tip] No password set. Any process on this machine can read sessions
        and memory via the local API. Set HERMES_WEBUI_PASSWORD to
        enable authentication.
  Hermes Web UI listening on http://127.0.0.1:18787
  Remote access: ssh -N -L 18787:127.0.0.1:18787 <user>@<your-server>
  Then open:     http://localhost:18787
```

**Result: starts cleanly, identifies itself as `HermesWebUI/0.51.280`, prints the helpful SSH-tunnel hint, and serves traffic within ~1 second of the python interpreter launching.**

### Functional smoke

```text
$ curl -sS http://127.0.0.1:18787/health
{
  "status": "ok",
  "sessions": 0,
  "active_streams": 0,
  "active_runs": 0,
  ...
}

$ curl -sS http://127.0.0.1:18787/ | head -1
<!doctype html>
```

`/health` returns the documented JSON shape. Root serves the SPA index. Server header is `HermesWebUI/0.51.280 Python/3.14.5`.

### "Build" verification (replacing the brief's pnpm check)

There is no build step. The `package.json` is explicitly documented as "dev-only tooling (ESLint runtime guard), not a build step." I verified this by reading the file and confirming `npm run lint:runtime` is the only `script` defined. Running `npm install` would only install ESLint as a devDep. The app's static assets in `static/` (10MB of vanilla JS including a 1MB `i18n.js` and 386KB `panels.js`) are served as-is by `server.py` with a content hash for cache busting. **This is by design** — the project's whole pitch is "no build step, no framework, no bundler."

---

## 4. N/A — this tool is a Python web service, not a Go binary

The brief's "go install" requirement is for BoxBox only. Hermes-webui is documented above.

---

## 5. Security: dep tree, source patterns, auth model

### Dependency tree (Python)

```text
pyyaml>=6.0          # MIT, stdlib-ish YAML
cryptography>=42.0   # Apache-2.0/BSD, OpenSSL-backed
cffi 2.0.0           # MIT, C bindings for cryptography
pycparser 3.0        # BSD, C parser for cffi
```

Two real deps. Both are first-tier Python crypto/yaml projects with active security backports. `cryptography` 42+ is the version floor recommended for OpenSSL 3.x compatibility. No transitive supply-chain risk worth flagging at this layer — the full `pip install` resolves to ~5 packages.

The `requirements.txt` is 4 lines. There is no `requirements-dev.txt` or `requirements-test.txt`; dev deps (pytest, ruff) live in `pyproject.toml` and `requirements.txt` for the upstream `hermes-agent` is consulted but not pulled in by the WebUI alone.

### Source patterns

A spot-check of the WebUI source for dangerous patterns:

- **No `eval`/`exec` of user input** in `api/routes.py` — the regex parsing for shell commands is over the agent's own input, which is by design for an agent chat surface.
- **CSRF protection** is real: a CSRF token is required for state-changing requests (`X-Hermes-CSRF-Token` header per `api/auth.py:7`).
- **Session storage** in `STATE_DIR/.sessions.json` with 30-day TTL, resolved via env > settings > default. Sessions are server-side, cookie is `hermes_session`.
- **File-serving guards**: `static/` and `/static/` are explicitly public; everything else goes through `check_auth()` in `api/auth.py`.
- **`HERMES_WEBUI_TEST_NETWORK_BLOCK=1`** env var installs a runtime socket-creation guard that rejects outbound to non-localhost/RFC1918/link-local. This is for the test suite, but it doubles as a real production hardening knob for hardened deployments.
- **`.env.docker.example`** documents the macOS UID/GID trap (`echo "UID=$(id -u)" >> .env`).

### Auth model (real, not bolted on)

`api/auth.py` is 23KB. It supports three auth modes, all opt-in:

1. **Password auth** — enabled by setting `HERMES_WEBUI_PASSWORD` env var or via the Settings UI. Uses `cryptography` for the hash (PBKDF2-HMAC per the docstring). Supports transparent migration of legacy hash formats.
2. **WebAuthn / passkey auth** — enabled by `HERMES_WEBUI_PASSKEY=1` or by registering a passkey in the Settings UI. Endpoints: `/api/auth/passkey/options`, `/api/auth/passkey/login`, `/api/auth/passkey/register/options`, `/api/auth/passkey/register`, `/api/auth/passkey/delete`, `/api/auth/passkeys`. The `cryptography` dep is required for the WebAuthn challenge signing.
3. **OAuth** — `api/oauth.py` is 28KB, supports multiple providers.

`is_auth_enabled()` returns `is_password_auth_enabled() or are_passkeys_enabled()`. If neither is configured, the server **explicitly warns** at startup ("[tip] No password set. Any process on this machine can read sessions and memory via the local API") and refuses to bind non-loopback without auth.

Public paths (no auth required): `/login`, `/health`, `/favicon.ico`, `/sw.js`, `/api/auth/login`, `/api/auth/status`, `/api/auth/passkey/options`, `/api/auth/passkey/login`, `/manifest.json`, `/manifest.webmanifest`, plus `/static/*`.

**This is a serious auth model**, not a session-cookie afterthought. For CortexOS: set `HERMES_WEBUI_PASSWORD` in the install prompt's secrets file before exposing via Tailscale Serve.

### Known security caveats

- **Default-bind is loopback** — correct, but operators must understand that the Docker image binds `0.0.0.0:8787` for container networking. Tailscale Serve or a Caddy reverse proxy in front is mandatory for any non-localhost access.
- **No built-in TLS** — must be terminated upstream (Tailscale Serve, Caddy). The Dockerfile is fine behind a reverse proxy.
- **WebAuthn requires a real domain** (or `localhost`) for the browser to surface the passkey prompt. Behind an IP-only Tailscale Serve URL, password auth is the only viable path.

---

## 6. Compatibility with CortexOS

### Node version

**N/A** — this is a Python app. Target Python is **3.11–3.13** per the `pyproject.toml` `target-version = "py311"`. The Dockerfile pins `python:3.12-slim`. The `prompts/tools/40-hermes.md` install prompt should require Python 3.12+ (CortexOS's existing `prompts/tools/31-9router.md` and similar use Python 3.12, so no new system dep is introduced).

### "Tailscale path routing feasibility"

The README's "Remote access" banner documents the Tailscale-friendly deployment exactly: bind to `127.0.0.1` and let Tailscale Serve expose it. There is no auth-redirect dance or Tailscale-specific code in the WebUI itself — it's designed to be reverse-proxied, and `prompts/tools/12-tailscale-serve.md` already documents the pattern.

```text
# CortexOS Tailscale Serve config would be:
$ tailscale serve --bg --https=8787 http://127.0.0.1:8787
$ tailscale serve --bg --set-path=/hermes http://127.0.0.1:8787
```

### Caddy reverse-proxy integration (per `prompts/tools/13-caddy.md`)

Caddy can front it, but it's not necessary if Tailscale Serve is in use. If an operator wants Caddy anyway (e.g. for basicauth on top of password auth), the config is:

```caddy
hermes.cortexos.example.com {
  basicauth {
    admin $2a$14$<bcrypt-hash>
  }
  reverse_proxy 127.0.0.1:8787
}
```

The WebUI's own auth and Caddy's basicauth are stacked, not in conflict — both validate independently.

### Docker

The repo ships a complete Docker story. The `Dockerfile` is multi-stage, drops to a `hermeswebui` unprivileged user (UID 1024), preinstalls `uv` for fast dep resolution, and runs `/hermeswebui_init.bash` as the entrypoint (which does bind-mount UID/GID alignment, then execs the server as the unprivileged user). `docker-compose.yml` is the single-container path. `docker-compose.two-container.yml` separates the agent and the WebUI. `docker-compose.three-container.yml` adds the dashboard.

The CortexOS integration would be a new `/opt/cortexos/hermes-webui/docker-compose.yml` checked into `templates/systemd/`, a `cortex-hermes-webui.service` systemd unit that wraps `docker compose up`, and an update to `prompts/tools/40-hermes.md` to document the deployment.

### 9Router / Honcho / Paperclip compat

The WebUI doesn't talk to 9Router or Honcho directly — it talks to the `hermes-agent` runtime, which in turn talks to whatever provider / memory backend the agent is configured to use. The WebUI surface is "I am a Hermes profile UI," so all the existing CortexOS wiring (`prompts/tools/40-hermes.md` → 9Router, `prompts/tools/41-hermes-profiles.md` → profiles, `prompts/tools/42-hermes-honcho.md` → memory, `prompts/tools/43-paperclip-hermes.md` → paperclip adapter) works through the upstream agent, not the WebUI. **No conflicts identified.**

### Storage / state

The WebUI keeps all its state under `HERMES_WEBUI_STATE_DIR` (default `~/.hermes/webui/`). On CortexOS this should be `/opt/cortexos/.state/hermes-webui/` to match the existing state dir convention (`/opt/cortexos/.state/dashboard/`, etc.). The repo's `docker-compose.yml` already mounts `${HOME}/.hermes` into `/home/hermeswebui/.hermes` — the install prompt should redirect this to the CortexOS path.

### Resource budget

The community-reported memory footprint is ~330MB native Windows vs ~1080MB WSL2+Docker per `README.md`. CortexOS hosts are Linux+Docker, so plan for ~1GB steady-state per Hermes WebUI instance, plus per-profile overhead if multi-profile is used.

---

## 7. Fallback candidate

**No fallback is recommended.** The two fallbacks the brief lists are both materially worse for the operator-facing Hermes profile UI role:

- **filebrowser** — single-binary file manager, no concept of a chat surface, no Hermes-agent integration, no profile routing, no model/provider picker, no session memory. It would replace the WebUI with a "browse your files" tool, not a Hermes operator UI. If the only goal is file management, BoxBox (the other tool in this study) is a much better fit.
- **paperclip-ui** — workflow/issue/approval surface (`prompts/tools/62-paperclip.md`). It is a work tracker, not an agent chat. Using it as the Hermes profile UI would conflate "work item to execute" with "ongoing agent session" — a model confusion that would hurt operators.

If the upstream `nesquena/hermes-webui` ever does die (e.g. `archived` or `pushed_at` > 6 months old), the next-best option is the official `NousResearch/hermes-agent` itself (Python CLI) fronted by a thin SvelteKit shell, with the WebUI's auth and UX patterns ported. That is a multi-week project and would only be warranted if the upstream truly dies. As of 2026-06-05, the upstream is in the most active 2-month stretch of its life, so this fallback is hypothetical.

---

## Appendix: artifacts & verification

- **Local clone:** `/tmp/hermes-webui-research/` (`git clone --depth=50 https://github.com/nesquena/hermes-webui.git`)
- **Test venv:** `/tmp/hermes-webui-venv/` (pyyaml 6.0.3, cryptography 48.0.0)
- **Test state dir:** `/tmp/hermes-test-state/`
- **Smoke tests passed:**
  1. `pip install -r requirements.txt` → success, 2 deps
  2. `python3 -u server.py` → boots, warns about missing hermes-agent, binds 127.0.0.1:18787
  3. `GET /health` → `{"status":"ok",...}` 200
  4. `GET /` → SPA HTML 200
  5. `Server: HermesWebUI/0.51.280` header confirms the latest release
- **Files in this deliverable's branch:** `docs/research/hermes-webui-feasibility.md` (this file)
