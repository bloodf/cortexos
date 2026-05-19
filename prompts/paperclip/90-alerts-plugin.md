# 90 — Paperclip alerts plugin

> Operator setup for the dashboard-alerts → Paperclip-notifications bridge.

This prompt wires `cortex.alerts.<severity>.<source>` events emitted by the
dashboard into Paperclip notifications. Skip this prompt if you do not want
Paperclip to receive operational alerts.

## Todo

- [ ] What you get
- [ ] Configuration
- [ ] Apply
- [ ] Smoke test
- [ ] Troubleshooting

## What you get

- Dashboard `lib/alerts.publishAlert` publishes each alert to NATS subject
  `cortex.alerts.<severity>.<source>` with an HMAC-signed envelope.
- `stacks/cortex-paperclip-bridge/alerts.js` subscribes via the JetStream durable
  consumer `cortex-paperclip-bridge-alerts` on filter `cortex.alerts.>` and
  forwards each event to Paperclip `POST /api/notifications`.
- If Paperclip returns 404 for `/api/notifications`, the bridge falls back to
  creating a comment with label `priority:high` on the configured ops issue.

## Prerequisites

- P0–P7 of the Paperclip plan are complete.
- `cortex-paperclip-bridge` is deployed and connected to NATS.
- A Paperclip API key with notification and comment permissions.

## Configuration

Set on the bridge host (e.g. `/opt/cortexos/secrets/bridge.env`):

| Variable | Default | Purpose |
|---|---|---|
| `BRIDGE_ALERTS_ENABLED` | `1` | Set to `0` to disable the alerts task without redeploying. |
| `BRIDGE_ALERTS_MIN_SEVERITY` | `warning` | One of `info`, `warning`, `critical`. Events below this drop silently. |
| `BRIDGE_ALERTS_DIGEST` | `0` | Set to `1` to batch `info` alerts into a 5-minute digest POST. |
| `BRIDGE_ALERTS_OPS_ISSUE_ID` | _(empty)_ | Issue ID to comment on when `/api/notifications` returns 404. |
| `PAPERCLIP_API_URL` | _(required)_ | Base URL of the Paperclip API. |
| `PAPERCLIP_API_KEY` | _(required)_ | Bearer token for Paperclip API. |
| `CORTEX_NATS_HMAC` | _(required)_ | Shared secret used by HMAC envelope verification. Must match dashboard. |

Set on the dashboard host (`/opt/cortexos/secrets/dashboard.env`):

| Variable | Default | Purpose |
|---|---|---|
| `NATS_URL` | _(empty disables publish)_ | NATS server URL the dashboard publishes to. |
| `CORTEX_NATS_HMAC` | _(required when NATS_URL set)_ | Same HMAC shared secret as the bridge. |
| `ADMIN_TOKEN` | _(empty disables header auth)_ | Optional bearer used by `X-Admin-Token` header to authorize `/api/paperclip/notify-test`. |

## Apply

Restart the bridge so the alerts task is spawned alongside server + worker:

```bash
sudo systemctl restart cortex-paperclip-bridge.service
sudo journalctl -u cortex-paperclip-bridge.service -f
```

Look for: `[alerts] ready durable=cortex-paperclip-bridge-alerts filter=cortex.alerts.> minSeverity=warning digest=false`.

## Smoke test

From the dashboard host (admin session) or any host with `ADMIN_TOKEN`:

```bash
curl -sS -X POST \
  -H "X-Admin-Token: $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"title":"plugin smoke test","body":"ignore","source":"smoke"}' \
  "$DASHBOARD_URL/api/paperclip/notify-test"
```

Expected response:

```json
{ "ok": true, "subject": "cortex.alerts.critical.test", "timestamp": "..." }
```

Then verify:

1. `[alerts] ...` log line on the bridge journal showing receipt.
2. Notification appears on the Paperclip board with severity `critical`.
3. If `BRIDGE_ALERTS_OPS_ISSUE_ID` is set and `/api/notifications` returned 404,
   confirm the comment landed on the ops issue with label `priority:high`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `[alerts] disabled via BRIDGE_ALERTS_ENABLED=0` | Kill switch set. | Unset env or set to `1`, restart. |
| `[alerts] PAPERCLIP_API_URL / PAPERCLIP_API_KEY not set` | Missing credentials. | Populate bridge env, restart. |
| `hmac_invalid` errors in journal | Dashboard and bridge use different `CORTEX_NATS_HMAC`. | Align secrets in both env files. |
| `dropped_rate` count rising | More than 10 alerts/minute from one source. | Reduce noise at source, or raise limit by editing `lib/alerts.js`. |
| `dropped_severity` for expected events | `BRIDGE_ALERTS_MIN_SEVERITY` too high. | Lower (e.g. `info`) and restart. |
| No notifications, no errors | `BRIDGE_ALERTS_DIGEST=1` and only `info` events — buffered until 5-min flush. | Wait, or unset digest mode. |
| 503 from `notify-test` | Dashboard `NATS_URL` unset. | Set and restart dashboard. |
| 401/403 from `notify-test` | Neither admin session nor matching `X-Admin-Token`. | Log in as admin or set `ADMIN_TOKEN` and pass via header. |

## Rollback

```bash
# Kill the alerts task only; bridge server + worker keep running.
sudo systemctl set-environment BRIDGE_ALERTS_ENABLED=0
sudo systemctl restart cortex-paperclip-bridge.service
```

To roll back fully, remove `node alerts.js &` from `entrypoint.sh` and redeploy.

## Related

- [`docs/NATS-CONTRACT.md`](../../docs/NATS-CONTRACT.md) — `cortex.alerts.<severity>.<source>` schema.
- [`stacks/cortex-paperclip-bridge/lib/alerts.js`](../../stacks/cortex-paperclip-bridge/lib/alerts.js)
- [`packages/cortex-dashboard/src/lib/alerts.ts`](../../packages/cortex-dashboard/src/lib/alerts.ts)
- [`packages/cortex-dashboard/src/app/api/paperclip/notify-test/route.ts`](../../packages/cortex-dashboard/src/app/api/paperclip/notify-test/route.ts)
