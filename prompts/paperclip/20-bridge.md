# Paperclip ↔ CortexOS — Install Bridge Daemon

> Stage 2. Run after `10-install.md` CHECKPOINT 1.A passes.

## 1. Apply migration 005

```bash
cd /opt/cortexos/dashboard
node scripts/migrate.js
```

Expected output: `005_paperclip_ticket_link applied`.

Verify:

```bash
sudo -u postgres psql -d cortex -c "\d paperclip_ticket_link"
```

## 2A. Compose path

```bash
cd /opt/cortexos/stacks/cortex-paperclip-bridge
docker compose up -d --build
docker compose ps
```

Compose reads `/opt/cortexos/.secrets/paperclip.env`. The container listens on `127.0.0.1:8089`.

## 2B. Systemd path (no Docker)

```bash
cd /opt/cortexos/stacks/cortex-paperclip-bridge
sudo -u cortex npm ci --omit=dev
sudo install -m 0644 cortex-paperclip-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cortex-paperclip-bridge
sudo systemctl status cortex-paperclip-bridge
```

## 3. Wire Caddy (public path)

Add to the existing Caddyfile, mirroring how the dashboard route is exposed:

```caddy
handle /paperclip/heartbeat {
  reverse_proxy 127.0.0.1:8089
}
```

Reload Caddy.

## 4. Smoke test

```bash
# Local healthz (no auth):
curl -fsS http://127.0.0.1:8089/healthz

# Inbound webhook with the configured bearer (loopback):
TOKEN="$(sudo grep -E '^PAPERCLIP_WEBHOOK_SECRET=' /opt/cortexos/.secrets/paperclip.env | cut -d= -f2-)"
curl -fsS -X POST http://127.0.0.1:8089/paperclip/heartbeat \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "runId":"smoke_1",
    "agentId":"cortexos-bridge",
    "cortexRole":"ENG-BACKEND",
    "context":{"taskId":"issue_smoke","wakeReason":"manual","commentId":null}
  }'
```

Expected: HTTP 202, body `{"runId":"smoke_1","status":"queued"}`.

Confirm the link row:

```bash
sudo -u postgres psql -d cortex -c "SELECT paperclip_run_id, cortex_role, status FROM paperclip_ticket_link ORDER BY id DESC LIMIT 1;"
```

## CHECKPOINT 2.A

- [ ] Migration 005 applied (`\d paperclip_ticket_link` shows the table).
- [ ] Bridge `/healthz` returns 200 OK.
- [ ] Smoke heartbeat returns 202 and writes a row.
- [ ] `journalctl -u cortex-paperclip-bridge -n 50` (or `docker compose logs`) shows no errors.

## Rollback

```bash
sudo systemctl disable --now cortex-paperclip-bridge   # or: docker compose down
sudo -u postgres psql -d cortex -f /opt/cortexos/dashboard/migrations/005_paperclip_ticket_link.rollback.sql
```
