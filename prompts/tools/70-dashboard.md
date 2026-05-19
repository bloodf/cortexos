# Dashboard (latest)

## Purpose

Build and deploy the CortexOS Next.js dashboard to the VPS as a Docker
Compose service built **on the VPS** from the materialized repo at
`/opt/cortexos`. The dashboard is a live read/update panel over VPS
state — it does NOT import or store credentials. No rsync, no
laptop-side build.

## Todo

- [ ] Prerequisites verified (DB, Caddy, OpenClaw, Docker)
- [ ] CHECKPOINT 1 confirmed (network + secrets present)
- [ ] Supply-chain gate passed for release tarball
- [ ] `docker compose up -d --build` succeeded
- [ ] `/api/health` returns 200
- [ ] CHECKPOINT 2 confirmed
- [ ] Public URL serves login page via Caddy
- [ ] CHECKPOINT 3 confirmed

## Prerequisites

- `14-postgresql.md` completed (schema already applied).
- `13-caddy.md` completed (Caddy proxies `{DOMAIN}` → port 3080).
- `40-openclaw.md` completed (dashboard chat panel connects to OpenClaw gateway).
- Docker Engine + Compose plugin installed on the VPS
  (`packages/cortex-dashboard/scripts/provision-vps.sh` installs them when missing).
- Repo materialized at `/opt/cortexos` via the bootstrap flow
  (`prompts/00-bootstrap.md`).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

> **Build runtime.** Image base is `node:22-slim`. Container runs as
> the non-root `node` user with `dumb-init` as PID 1.

## CHECKPOINT 1

**STOP — operator question:** Does `docker network inspect cortex-net >/dev/null 2>&1 && test -f /opt/cortexos/.secrets/dashboard.env && echo OK` print `OK` (not `network not found`, not empty)?

```bash
docker network inspect cortex-net >/dev/null 2>&1 \
  || docker network create cortex-net
test -f /opt/cortexos/.secrets/dashboard.env && echo OK
```

Type `confirmed` to proceed.

## Supply-chain gate (mandatory before build)

Before building or deploying the dashboard, verify the signed release
tarball on the VPS. The preflight prompt
(`prompts/tools/00-preflight.md` → Step 0) must have already installed
`cosign`, `syft`, and `gh`, and pinned `CORTEX_VERIFY_REPO`.

```bash
# From repo root on the VPS:
TAG="$(git describe --tags --abbrev=0)"
mkdir -p /tmp/cortex-release && cd /tmp/cortex-release
gh release download "$TAG" --repo "$CORTEX_VERIFY_REPO" --pattern 'dashboard-*'
"$OLDPWD/scripts/verify-artifact.sh" "dashboard-${TAG}.tar.gz" --ref "refs/tags/${TAG}"
```

Expected: `[verify] OK: dashboard-<TAG>.tar.gz verified (checksum + cosign + SBOM + provenance)`.

If verification fails: **HALT**. Do not run `docker compose build`.
Investigate before proceeding — see
[docs/SUPPLY-CHAIN.md](../../docs/SUPPLY-CHAIN.md).

## Build & start

The compose stack lives at
`/opt/cortexos/stacks/cortex-dashboard/docker-compose.yml`. Build
context points at `../..` (the repo root materialized by
bootstrap). The first `up --build` performs the full multi-stage build
(`deps → builder → runtime`).

```bash
# On the VPS, as the SSH user with docker group membership:
cd /opt/cortexos/stacks/cortex-dashboard
docker compose up -d --build
```

Subsequent rebuilds after `git pull` (or bootstrap re-materialization)
use the same command — Docker reuses cached layers when only source
changes.

Tail logs while the container starts:

```bash
docker compose logs -f cortex-dashboard
```

The container entrypoint:

1. Waits for PostgreSQL (`DB_HOST:DB_PORT` from the env file).
2. Runs idempotent migrations (`node scripts/migrate.js`).
3. Starts the bundled Next.js standalone server on port 3080.

**Do not** paste credentials into the dashboard UI. All keys are
sourced from VPS `.secrets/` files.

## Verify

```bash
curl -fsS http://127.0.0.1:3080/api/health
```

Expected: HTTP 200 with a JSON health payload.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/api/health` print `200` (not `000`, not `5xx`)?

Type `confirmed` to proceed.

## CHECKPOINT 2b

**STOP — operator question:** Does `docker compose ps cortex-dashboard --format json | jq -r .Health` print `healthy` (not `starting`, not `unhealthy`)?

Type `confirmed` to proceed.

## Public verification (through Caddy)

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://{DOMAIN}/en/login
```

Expected: `200`.

## CHECKPOINT 3

**STOP — operator question:** Does `curl -sS -o /dev/null -w "%{http_code}" https://${CORTEX_DOMAIN}/en/login` print `200` with no TLS error (not `000 (SSL certificate problem)`, not `502`)?

Type `confirmed` to proceed.

## Operations

| Action | Command |
|---|---|
| Restart | `docker compose restart cortex-dashboard` |
| Stop | `docker compose down` |
| Update env | edit `/opt/cortexos/.secrets/dashboard.env` → `docker compose up -d` |
| Rebuild after code change | `docker compose up -d --build` |
| View logs | `docker compose logs -f cortex-dashboard` |

## Next

→ `prompts/tools/80-agent-factory.md`
