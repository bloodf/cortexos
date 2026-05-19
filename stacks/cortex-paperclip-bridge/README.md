# cortex-paperclip-bridge

Stateless HTTP webhook receiver + JetStream status worker that bridges Paperclip and CortexOS.

> **Compose prerequisites.** This stack assumes the external `cortex-net` docker network exists and that NATS + Postgres are already reachable on it — bring them up via `prompts/tools/30-nats.md` + `prompts/tools/14-postgresql.md` before `docker compose up -d`.

## What it does

- `POST /paperclip/heartbeat` — Paperclip-initiated wake. Bridge persists the run in `paperclip_ticket_link`, publishes an HMAC-signed envelope to `cortex.paperclip.work.<role>`, and replies `202 { runId, status: "queued" }` in < 200ms.
- Status worker — durable JetStream consumer on `cortex.paperclip.status.>`. Verifies HMAC, PATCHes the Paperclip issue (`status`, `comment`, `costUsdCents`), updates `paperclip_ticket_link`, ACKs.

## Ports & files

| Item | Default | Notes |
|---|---|---|
| HTTP port | `8089` | Bind loopback; Caddy fronts public path. |
| Env file | `/opt/cortexos/.secrets/paperclip.env` | `chmod 600`, owner `cortex:cortex`. |
| Migration | `packages/cortex-dashboard/migrations/005_paperclip_ticket_link.sql` | Apply via `scripts/migrate.js`. |

## Env contract

See `templates/.secrets/paperclip.env.example`. Critical:

- `PAPERCLIP_API_URL`, `PAPERCLIP_API_KEY` — outbound Paperclip mutating calls.
- `PAPERCLIP_WEBHOOK_SECRET` — inbound bearer (constant-time compared).
- `CORTEX_NATS_HMAC` — **must** match `cortex-consumer`. Envelope shape:

  ```json
  { "data": "<payload>", "sig": "<sha256(JCS(data), key)>" }
  ```

- `PG_DSN` — Postgres DSN for the link table.

## Run modes

### Docker compose

```bash
docker compose -f stacks/cortex-paperclip-bridge/docker-compose.yml up -d --build
```

Requires `cortex-net` external network and `/opt/cortexos/.secrets/paperclip.env` on host.

### Systemd (host)

```bash
sudo cp stacks/cortex-paperclip-bridge/cortex-paperclip-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-paperclip-bridge
```

Hardening matches `templates/systemd/cortex-dashboard.service` plus `Type=notify`, `WatchdogSec=30`, `MemoryDenyWriteExecute`.

## Tests

```bash
pnpm install
pnpm test                  # unit (vitest)
RUN_INTEGRATION=1 pnpm run test:integration   # needs NATS + Postgres up
```

Coverage target: ≥80% for `server.js`, `worker.js`, `lib/*`.

## Log format

Plain stderr/stdout lines prefixed `[bridge]` / `[worker]`. JSON logging is left to journald + Promtail (Phase P7).

## NATS subject layout

| Subject | Direction | Purpose |
|---|---|---|
| `cortex.paperclip.work.<role>` | bridge → consumer | Wake CortexOS for a Paperclip run. |
| `cortex.paperclip.status.<role>` | consumer → bridge | Terminal status push back to Paperclip. |
| `cortex.paperclip.approval.<role>` | reserved | P3 governance gate. |

## HMAC envelope

Envelope shape is identical to `stacks/cortex-consumer` HMAC convention (RFC-8785 JCS over `data`, SHA-256 with `CORTEX_NATS_HMAC`). Both sides must hold the same secret.
