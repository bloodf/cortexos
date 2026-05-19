# Paperclip ↔ CortexOS — Rollback Drill

> Stage 7. Practice (or execute) a clean rollback of the Paperclip
> integration. Target: complete on staging in under 15 minutes.

## Goal

Restore CortexOS to a Paperclip-free state with the dashboard, NATS, and
the consumer fully healthy, while preserving audit data. The drill is the
ground truth for the rollback row in `docs/PAPERCLIP.md` and Section 9
of the integration plan.

## When to run

- After every meaningful change to bridge, consumer, or migration 005.
- Before the first production deploy of each phase.
- Quarterly, as a fire drill.
- Immediately when `60-post-install-validation.md` reports
  `result=fail` with a `failure.tag` in the SECURITY tier
  (`*-not-401`, `approval-bypass`).

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Pre-flight (2 min)
- [ ] Per-phase rollback
- [ ] Post-rollback verification (3 min)
- [ ] Verification checklist
- [ ] Time budget

## Pre-flight (2 min)

1. Open two terminals on the target host.
2. Capture the current state for diff:

   ```bash
   sudo systemctl status cortex-paperclip-bridge cortex-consumer cortex-dashboard \
     > /tmp/pre-rollback.systemd.txt
   psql "$PG_DSN" -c "SELECT COUNT(*), MAX(updated_at) FROM paperclip_ticket_link" \
     > /tmp/pre-rollback.linkrows.txt
   git -C /opt/cortexos rev-parse HEAD > /tmp/pre-rollback.sha.txt
   ```

3. Confirm a recent dashboard DB backup exists (`pg_dump` on the same day).

## Per-phase rollback

### P2 — Bridge MVP

| Step | Command                                                                 | Verify                                                         |
| ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1    | `systemctl stop cortex-paperclip-bridge`                                | `systemctl is-active cortex-paperclip-bridge` -> `inactive`    |
| 1a   | (compose mode) `docker compose -f stacks/cortex-paperclip-bridge/docker-compose.yml stop` | `docker compose ps` shows the bridge stopped     |
| 2    | `psql "$PG_DSN" -f packages/cortex-dashboard/migrations/005_paperclip_ticket_link.rollback.sql` | `\dt paperclip_ticket_link` returns `Did not find any relation` |
| 3    | `git -C /opt/cortexos revert <consumer-paperclip-commit>`               | `consumer.js` no longer subscribes `cortex.paperclip.work.>`   |
| 4    | `systemctl restart cortex-consumer`                                     | Consumer logs show only legacy subjects                        |
| 5    | `rm /opt/cortexos/.secrets/paperclip.env /opt/cortexos/.secrets/paperclip-keys.json` | `ls /opt/cortexos/.secrets/` no paperclip-* entries  |

Total: 8–10 min.

### P3 — Role registration + governance

| Step | Command                                                              | Verify                                                  |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | In Paperclip UI: pause every routine for the company.                | Routines table all `paused`.                            |
| 2    | `git -C /opt/cortexos revert <frontmatter-commit>`                   | `git grep -n '^paperclip:' templates/agent-roles/` empty |
| 3    | `git -C /opt/cortexos revert <dashboard-panel-commit>`               | `/en/paperclip` returns 404                              |
| 4    | `rm /opt/cortexos/.secrets/paperclip-keys.json`                      | `ls -la` no key file                                    |

Routines stay paused until P3 is re-deployed or the integration is
abandoned.

### P4 — Post-install validation + docs + nightly CI

Docs and CI only. Revert the offending commit; no host state.

```bash
git -C /opt/cortexos revert <commit-sha>
gh workflow disable .github/workflows/paperclip-smoke.yml
```

### P5 / P6 / P7 / P8

See `docs/PAPERCLIP.md` § "Rollback procedures" for the long-form
checklists; this prompt covers the bridge + dashboard surface only.

## Post-rollback verification (3 min)

Run after every rollback. Each line must succeed:

```bash
# Bridge fully gone.
systemctl is-active cortex-paperclip-bridge && { echo FAIL; exit 1; } || echo OK

# Migration reverted.
psql "$PG_DSN" -c "SELECT to_regclass('public.paperclip_ticket_link')" | grep -q '^\s*$' \
  || psql "$PG_DSN" -c "SELECT to_regclass('public.paperclip_ticket_link')" | grep -q NULL \
  && echo OK || { echo FAIL; exit 1; }

# Consumer healthy on legacy subjects.
systemctl is-active cortex-consumer && echo OK || { echo FAIL; exit 1; }
journalctl -u cortex-consumer --since '2 min ago' | grep -E 'cortex\.paperclip\.' \
  && { echo "consumer still subscribed to paperclip"; exit 1; } || echo OK

# Dashboard reachable.
curl -fsS http://127.0.0.1:3080/en/login > /dev/null && echo OK || { echo FAIL; exit 1; }

# Secrets cleaned.
test ! -f /opt/cortexos/.secrets/paperclip.env && echo OK || { echo FAIL; exit 1; }
test ! -f /opt/cortexos/.secrets/paperclip-keys.json && echo OK || { echo FAIL; exit 1; }
```

## Verification checklist

- [ ] Bridge service stopped (and removed in compose mode).
- [ ] Migration 005 rollback applied; `paperclip_ticket_link` absent.
- [ ] Consumer reverted; no `cortex.paperclip.>` subscription.
- [ ] Dashboard `/en/login` reachable; `/en/paperclip` 404.
- [ ] Paperclip routines paused in board UI (P3 only).
- [ ] `/opt/cortexos/.secrets/paperclip*` removed; file mode logs absent
      from `auditd` since rollback start.
- [ ] Rollback duration recorded in `/tmp/pre-rollback.*` artefacts.
- [ ] Sign-off entry posted to `cortex.alerts.info.rollback` topic.

## Time budget

Target ≤ 15 min on staging with 1 operator. P2 dominates: stop service
→ rollback SQL → consumer revert → restart → verify. Practice once per
phase before relying on it in prod.

## Related

- `prompts/paperclip/60-post-install-validation.md` — run immediately after rollback
  to confirm the bridge surface is genuinely gone (steps 1–6 must FAIL,
  which is the *correct* outcome here).
- `docs/PAPERCLIP.md` — full ops runbook + long-form rollback table.
- `docs/SECURITY.md` — incident response and secret rotation triggers.
- `packages/cortex-dashboard/migrations/005_paperclip_ticket_link.rollback.sql` — the
  authoritative rollback SQL.
