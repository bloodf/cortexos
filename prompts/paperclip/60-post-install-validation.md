# Paperclip ↔ CortexOS — Post-Install Validation

> VPS-only post-install validation of the paperclip pipeline. Stage 6.
> Run ON the VPS after Paperclip stage 5 (`50-approval-gates.md`)
> completes, or any time the bridge, consumer, or distro install path
> changes.

## Goal

Drive the canonical 28-step end-to-end validator
(`scripts/paperclip-smoke-test.sh`) against the target environment,
interpret the structured JSON summary, and decide PASS / FAIL with
evidence.

## When to run

| Trigger                                | Scope                                    |
| -------------------------------------- | ---------------------------------------- |
| Pre-merge CI (every PR)                | Steps 1–6 + 15–18 (no real Paperclip)    |
| Nightly CI (`paperclip-smoke.yml`)     | Full 1–21 against staging                |
| Manual operator (this prompt)          | Full 1–28                                |
| Phase gate (P2..P8 "done" check)       | Full 1–28                                |

## Required environment

The script reads its configuration from environment variables. On a VPS,
source `/opt/cortexos/.secrets/paperclip.env` first; in CI, the secrets
land via `STAGING_*` repository secrets.

```bash
sudo -u cortex env $(sudo grep -v '^#' /opt/cortexos/.secrets/paperclip.env | xargs) \
  bash -c 'env | grep -E "^(PAPERCLIP|BRIDGE|NATS|PG)_"'
```

Required:

| Variable                    | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `PAPERCLIP_API_URL`         | Board API base, e.g. `https://paperclip…`      |
| `PAPERCLIP_API_KEY`         | Company-scoped board token (read+write)        |
| `PAPERCLIP_WEBHOOK_SECRET`  | Bearer shared with the bridge                  |
| `BRIDGE_URL`                | Bridge HTTP base, e.g. `http://127.0.0.1:8089` |
| `NATS_URL`                  | NATS / JetStream URL                           |
| `PG_DSN`                    | Dashboard Postgres DSN                         |

Optional:

| Variable                  | Default       | Notes                                      |
| ------------------------- | ------------- | ------------------------------------------ |
| `SMOKE_ROLE`              | `ENG-BACKEND` | CortexOS role to exercise                  |
| `SMOKE_TIMEOUT_SEC`       | `300`         | Wall-clock cap per long step               |
| `SMOKE_POLL_INTERVAL_SEC` | `5`           | Poll cadence                               |
| `SMOKE_PROJECT_ID`        | `smoke`       | Target Paperclip project                   |
| `SMOKE_SKIP_DISTRO`       | `0`           | `1` to skip steps 22–28 (CI staging mode)  |
| `SMOKE_DASHBOARD_URL`     | `http://127.0.0.1:3080/en/login` | Used in step 25      |

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Source `paperclip.env`; confirm required vars are exported
- [ ] Run `scripts/paperclip-smoke-test.sh --phase P4` (or current phase)
- [ ] Capture `/tmp/smoke.json` summary + `/tmp/smoke.log` stream
- [ ] Confirm exit code 0
- [ ] Confirm summary `result == "pass"`
- [ ] Confirm summary `failure == null`
- [ ] Confirm wall-clock < `2 * SMOKE_TIMEOUT_SEC`
- [ ] Attach `/tmp/smoke.json` to change ticket
- [ ] CHECKPOINT 6.A confirmed — smoke run PASS

## Run

```bash
cd /opt/cortexos
sudo -u cortex env $(sudo grep -v '^#' /opt/cortexos/.secrets/paperclip.env | xargs) \
  scripts/paperclip-smoke-test.sh --phase P4 > /tmp/smoke.json 2> /tmp/smoke.log
```

- `--phase <P2..P8>`: tag the phase in the summary; choose the phase under test.
- `--from-step N`: resume at step `N` (e.g. `--from-step 7` to skip pre-flight).
- `--dry-run`: validate environment and harness without contacting any service.

## Output contract

`stderr` (`/tmp/smoke.log`): one compact JSON object per line. Three kinds:

```json
{"ts":"2026-05-18T01:23:45Z","kind":"step_start","step":7,"name":"create-issue"}
{"ts":"2026-05-18T01:23:46Z","kind":"step_end","step":7,"name":"create-issue","result":"pass","duration_ms":142}
{"ts":"2026-05-18T01:23:46Z","kind":"event","level":"info","message":"…","step":"7"}
```

`stdout` (`/tmp/smoke.json`): single summary object, shape:

```json
{
  "result":   "pass" | "fail",
  "phase":    "P4",
  "duration_sec": 312.4,
  "steps":    [ { "id": 1, "name": "bridge-healthz", "result": "pass", "duration_ms": 18 }, … ],
  "failure":  null | { "step": 11, "tag": "SMOKE-FAIL:consumer-no-claim", "evidence": "…" },
  "git_sha":  "abc1234…",
  "paperclip_pinned_sha": "…",
  "distro":   "ubuntu-24.04",
  "role":     "ENG-BACKEND"
}
```

Exit code: `0` PASS, `1` FAIL.

## Failure tag catalog

Use the `failure.tag` to jump to the right remediation. All tags share the
`SMOKE-FAIL:` prefix.

| Tag                          | Likely cause                                                      |
| ---------------------------- | ----------------------------------------------------------------- |
| `env-missing`                | Required env var unset. Check `paperclip.env`.                    |
| `bridge-healthz`             | Bridge service down. `systemctl status cortex-paperclip-bridge`.  |
| `nats-unreachable`           | NATS down or wrong URL. `systemctl status nats`.                  |
| `jetstream-stream-missing`   | JetStream `CORTEX` stream missing `cortex.paperclip.>`.           |
| `pg-table-missing`           | Migration 005 not applied. Re-run `dashboard/migrate.js`.          |
| `paperclip-api-unreachable`  | Paperclip down or wrong key/URL.                                  |
| `role-not-registered`        | Run `scripts/paperclip-register-roles.ts`.                        |
| `bridge-ack-timeout`         | Bridge accepted webhook but did not write link row.               |
| `nats-work-missed`           | Bridge did not publish to NATS. Check HMAC + connection logs.     |
| `consumer-no-claim`          | Consumer durable missing or paused.                               |
| `no-commit`                  | OMC factory did not produce a commit within `SMOKE_TIMEOUT_SEC`.  |
| `status-patch-missing`       | Worker did not PATCH Paperclip. Check `cortex.paperclip.status.*`.|
| `link-row-stale`             | Final link row not updated. Likely worker error retry-storm.       |
| `wrong-bearer-not-401`       | Bridge auth regression. SECURITY.                                 |
| `missing-bearer-not-401`     | Bridge auth regression. SECURITY.                                 |
| `length-mismatch-not-401`    | `timingSafeEqual` length-leak regression.                         |
| `replay-not-idempotent`      | Migration 005 `UNIQUE(paperclip_run_id)` missing.                 |
| `approval-bypass`            | Destructive op dispatched without approval. SECURITY.             |
| `approval-no-timebox`        | Approval queue is unbounded. Check policy.                        |
| `budget-not-enforced`        | Consumer ignores budget cap. Cost accounting regression.          |
| `os-detect-fail` / `pkg-dispatch-fail` | Distro foundation regression (P0).                      |

## Resuming

If a step fails on something transient (e.g. `bridge-ack-timeout` while
the bridge was restarting), re-run from the earliest still-relevant step:

```bash
scripts/paperclip-smoke-test.sh --from-step 7 --phase P4
```

The script is idempotent: replays land on the existing link row via
`UNIQUE(paperclip_run_id)`. Use `--from-step 15` to re-run only the
negative path without re-creating an issue.

## CHECKPOINT 6.A

**STOP — operator question:** Does `jq -r '.result' /tmp/smoke.json` print `pass` AND `jq -r '.failure' /tmp/smoke.json` print `null` (not `fail`, not a `SMOKE-FAIL:` tag object)?

Type `confirmed` to proceed.

Attach `/tmp/smoke.json` to the change ticket. If FAIL, attach the
`SMOKE-FAIL:<tag>` line and the surrounding `step_end` records from
`/tmp/smoke.log` for triage.

## Related

- `prompts/paperclip/70-rollback.md` — rollback drill if smoke fails post-deploy.
- `docs/PAPERCLIP.md` — architecture + ops runbook.
- `scripts/paperclip-smoke-test.sh` — the orchestrator itself.
- `.github/workflows/paperclip-smoke.yml` — manual-trigger CI workflow.
