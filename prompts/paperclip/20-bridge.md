# Paperclip ↔ CortexOS — Install Bridge Daemon

> Stage 2. Run after `10-install.md` CHECKPOINT 1.A passes.

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Run `node scripts/migrate.js` from `/opt/cortexos/dashboard`
- [ ] Verify `\d paperclip_ticket_link` shows the table
- [ ] Bring bridge up via compose (2A) or systemd (2B)
- [ ] Add `/paperclip/heartbeat` reverse_proxy block to Caddyfile + reload
- [ ] `curl http://127.0.0.1:8089/healthz` returns 200
- [ ] Send bearer-protected probe heartbeat; expect HTTP 202 + `status:queued`
- [ ] Confirm new row in `paperclip_ticket_link`
- [ ] CHECKPOINT 2.A confirmed — /healthz returns 200
- [ ] CHECKPOINT 2.B confirmed — probe returns 202 + DB row
- [ ] CHECKPOINT 2.C confirmed — no error lines in bridge logs

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
sudo -u cortex pnpm install --frozen-lockfile --prod
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

## 4. Bridge probe

```bash
# Local healthz (no auth):
curl -fsS http://127.0.0.1:8089/healthz

# Inbound webhook with the configured bearer (loopback):
TOKEN="$(sudo grep -E '^PAPERCLIP_WEBHOOK_SECRET=' /opt/cortexos/.secrets/paperclip.env | cut -d= -f2-)"
curl -fsS -X POST http://127.0.0.1:8089/paperclip/heartbeat \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "runId":"probe_1",
    "agentId":"cortexos-bridge",
    "cortexRole":"ENG-BACKEND",
    "context":{"taskId":"issue_probe","wakeReason":"manual","commentId":null}
  }'
```

Expected: HTTP 202, body `{"runId":"probe_1","status":"queued"}`.

Confirm the link row:

```bash
sudo -u postgres psql -d cortex -c "SELECT paperclip_run_id, cortex_role, status FROM paperclip_ticket_link ORDER BY id DESC LIMIT 1;"
```

## CHECKPOINT 2.A

**STOP — operator question:** Does `curl -fsS -o /dev/null -w "%{http_code}" http://127.0.0.1:8089/healthz` print `200` (not `000`, not `502`)?

Type `confirmed` to proceed.

## CHECKPOINT 2.B

**STOP — operator question:** Did the bearer probe POST return HTTP 202 with body containing `"status":"queued"` AND `psql -tAc "SELECT count(*) FROM paperclip_ticket_link WHERE paperclip_run_id='probe_1'"` print `1` (not `0`, not 401, not 500)?

Type `confirmed` to proceed.

## CHECKPOINT 2.C

**STOP — operator question:** Does `journalctl -u cortex-paperclip-bridge -n 50 --no-pager 2>/dev/null | grep -Ei 'error|fatal' | wc -l` (or `docker compose logs` equivalent) print `0` (not a positive integer)?

Type `confirmed` to proceed.

## Rollback

```bash
sudo systemctl disable --now cortex-paperclip-bridge   # or: docker compose down
sudo -u postgres psql -d cortex -f /opt/cortexos/dashboard/migrations/005_paperclip_ticket_link.rollback.sql
```
