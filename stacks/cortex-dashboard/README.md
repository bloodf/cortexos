# Cortex Dashboard stack

On-VPS Docker Compose build for the Next.js 16 dashboard. Replaces the
former laptop-side `rsync`/systemd deploy path.

## Pattern

- **Build runs on the VPS.** The bootstrap flow materializes the repo at
  `/opt/cortexos` via `git archive | ssh tar -x`, so `packages/cortex-dashboard/` is
  already present. `docker compose build` consumes that source.
- **No `depends_on` for Postgres, Hermes, Honcho, or Paperclip.** Those run as sibling
  containers or host services and are joined through the
  `cortex-net` external Docker network. Health is the integration
  contract, not compose ordering.
- **Non-root runtime.** Image runs as the `node` user with `dumb-init`
  as PID 1 for signal handling and zombie reaping.
- **Standalone Next.js bundle.** `next.config.ts` has
  `output: "standalone"`. The custom `server.ts` (Socket.IO + retention,
  alerts) is bundled via esbuild and replaces the stock standalone
  server.

## Prerequisites

1. Repo materialized at `/opt/cortexos` (see `prompts/00-bootstrap.md`).
2. `cortex-net` Docker network present:

   ```bash
   docker network inspect cortex-net >/dev/null 2>&1 \
     || docker network create cortex-net
   ```

3. `/opt/cortexos/.secrets/dashboard.env` populated (see
   `packages/cortex-dashboard/dashboard.env.example` and
   `packages/cortex-dashboard/scripts/provision-vps.sh`). Must include `DB_HOST`,
   `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and
   `CORTEX_MASTER_KEY`.
4. PostgreSQL reachable from the dashboard container. When Postgres
   runs on the host (default of `provision-vps.sh`), set
   `DB_HOST=host.docker.internal` (compose maps it automatically on
   recent engines) or `DB_HOST=<host-LAN-IP>`. When Postgres runs as a
   container on `cortex-net`, use its service name.

## Bring-up

```bash
cd /opt/cortexos/stacks/cortex-dashboard
docker compose up -d --build --remove-orphans
```

Tail logs:

```bash
docker compose logs -f cortex-dashboard
```

Health check:

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080/en/login
```

## Migrations

The container entrypoint (`docker-entrypoint.sh`) waits for Postgres,
then runs `node scripts/migrate.js` before launching the server.
Migrations are idempotent — re-running `docker compose up -d --build --remove-orphans`
is safe.

## Rebuild after code changes

```bash
cd /opt/cortexos
git pull   # or re-run bootstrap to refresh the tree
cd stacks/cortex-dashboard
docker compose up -d --build --remove-orphans
```

## Stop / remove

```bash
docker compose down            # stop, keep image
docker compose down --rmi local # also remove the built image
```

## Tailscale Serve

Tailscale Serve publishes the dashboard root to port 3080. No change required
when swapping systemd for compose — the listening port is identical.
