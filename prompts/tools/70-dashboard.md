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
- [ ] `/en/login` returns 200 through the container and the public URL
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

1. Waits for PostgreSQL (`DB_HOST:DB_PORT`). The compose service runs with `network_mode: host` and overrides `DB_HOST=127.0.0.1` so dashboard probes, Docker inventory, systemd, process, network, storage, and terminal pages target the VPS, not an isolated bridge container.
2. Runs idempotent migrations (`node scripts/migrate.js`).
3. Runs the dynamic service seed (`node scripts/dynamic-seed.js`). The compose file mounts `${CORTEXOS_ROOT:-/opt/cortexos}/.secrets/.setup-state.json` read-only at `/run/cortexos/setup-state.json`; the seed uses that completed-spoke list to mark installed services active, derive web UI visibility, and call `cortex_set_service_urls(...)` when `CORTEX_PUBLIC_BASE_URL`, `CORTEX_DASHBOARD_BASE_URL`, `PUBLIC_BASE_URL`, `CORTEX_DOMAIN`, or the setup-state Tailscale DNS evidence is available.
4. Starts the bundled Next.js standalone server on port 3080.

**Do not** paste credentials into the dashboard UI. All keys are
sourced from VPS `.secrets/` files.

## Verify

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080/en/login
```

Expected: `200`. Current dashboard builds gate `/api/health` behind auth, so `/en/login` is the stable unauthenticated liveness probe.

Verify the catalog was hydrated from the install state:

```bash
docker compose exec -T cortex-dashboard node -e '
const pg = require("pg");
const Client = pg.Client || pg.default?.Client;
const c = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "cortex_dashboard",
  user: process.env.DB_USER || "dashboard",
  password: process.env.DB_PASSWORD,
});
(async () => {
  await c.connect();
  const r = await c.query("select count(*)::int as n from services where is_active");
  console.log(r.rows[0].n);
  await c.end();
})().catch((err) => { console.error(err); process.exit(1); });
'
```

Expected after a normal full install: a non-zero count greater than the dashboard-only fallback (`1`). If it prints `1`, the setup-state mount or public-base inference is broken; copy the active `.secrets/.setup-state.json` into `${CORTEXOS_ROOT:-/opt/cortexos}/.secrets/.setup-state.json` and restart the dashboard before continuing.

Verify host integrations are populated:

```bash
docker compose exec -T cortex-dashboard node - <<'NODE'
const checks = [
  ["/api/docker", (d) => d.containers.data.length > 0],
  ["/api/system", (d) => d.mounts.length > 0 && d.drives.length > 0],
  ["/api/processes", (d) => d.processes.length > 0],
  ["/api/network", (d) => d.interfaces.length > 0],
  ["/api/services?healthcheck=true", (d) => d.services.length > 0],
];
(async () => {
  for (const [path, ok] of checks) {
    const res = await fetch(`http://127.0.0.1:${process.env.PORT || 3080}${path}`, {
      headers: { cookie: process.env.DASHBOARD_VERIFY_COOKIE || "" },
    });
    if (!res.ok) throw new Error(`${path} returned ${res.status}`);
    const data = await res.json();
    if (!ok(data)) throw new Error(`${path} returned an empty dashboard payload`);
    console.log(`${path}: ok`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
NODE
```

For authenticated endpoints, set `DASHBOARD_VERIFY_COOKIE=session_token=<admin-session-token>` before running the check.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -sS -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/en/login` print `200` (not `000`, not `5xx`)?

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
