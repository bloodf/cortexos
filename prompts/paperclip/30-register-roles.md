# Paperclip ↔ CortexOS — Register Agent Roles

> Stage 3. Run after `20-bridge.md` completes and the Paperclip API is reachable
> from the dashboard host.

## Goal

Hire every CortexOS agent role into the Paperclip company, mint per-agent API
keys, and persist them under `/opt/cortexos/.secrets/paperclip-keys.json`.

Role definitions live in `templates/agent-roles/*.md` as YAML frontmatter under
the `paperclip:` key. The registration script is the only supported path —
do **not** click through the Paperclip UI for routine hires.

## 1. Pre-flight

```bash
test -f /opt/cortexos/.secrets/paperclip.env
sudo grep -E 'PAPERCLIP_(API_URL|API_KEY|COMPANY_ID)' /opt/cortexos/.secrets/paperclip.env
```

Required env (operator-supplied, never committed):

- `PAPERCLIP_API_URL` — e.g. `https://paperclip.internal:8443`
- `PAPERCLIP_API_KEY` — board-level key with `agent.hire` + `agent.key.mint` scope
- `PAPERCLIP_COMPANY_ID` — Paperclip company UUID for this CortexOS host
- `BOARD_TOKEN` (optional) — when set, the script auto-approves each hire
  using `POST /api/approvals/:id/approve`. Omit for two-step approval flows.

## 2. Run the registration script

```bash
cd /opt/cortexos
sudo -u cortex env $(sudo grep -v '^#' /opt/cortexos/.secrets/paperclip.env | xargs) \
  tsx scripts/paperclip-register-roles.ts
```

Expected output:

```text
paperclip-register-roles: minted=18 skipped=0
  keys file: /opt/cortexos/.secrets/paperclip-keys.json
```

Re-running is **idempotent**: roles already present in Paperclip are reported
as `skipped`, and no duplicate keys are minted.

## 3. Verify the key file

```bash
sudo ls -l /opt/cortexos/.secrets/paperclip-keys.json
sudo jq '.keys | map(.role)' /opt/cortexos/.secrets/paperclip-keys.json
```

Expected:

- File mode `-rw-------` (`0600`), owner `cortex:cortex`.
- All 18 roles present: CEO, CTO, PM, PO, STAFF-ENG, ENG-BACKEND,
  ENG-FRONTEND, ENG-MOBILE, ENG-ESP32, ENGINEER, QA, UXUI, CORTEX,
  BOOK-AUTHOR, BOOK-EDITOR, BOOK-EVALUATOR, BOOK-REVIEWER, BOOK-TRANSLATOR.

## 4. Verify in Paperclip UI

Open `${PAPERCLIP_API_URL}/board` and confirm:

- 18 agents listed for the CortexOS company.
- Each agent shows its `cortexRole` tag, configured monthly budget, and the
  default routine `0 */15 * * * *`.
- The `Approvals` queue is empty (or matches `BOARD_TOKEN` policy).

## CHECKPOINT 3.A

- [ ] `paperclip-keys.json` exists with mode `0600` and contains 18 entries.
- [ ] Paperclip UI shows all 18 agents under the CortexOS company.
- [ ] Re-running the script reports `minted=0 skipped=18`.

Proceed to `40-routines-and-budgets.md` once 3.A passes.
