# 42 - Hermes ↔ Honcho Wiring

## Purpose

Configure each Hermes profile to use Honcho as its memory backend. Honcho is the only memory backend in CortexOS.

## Prerequisites

- `32-honcho.md` completed — Honcho API healthy on `http://127.0.0.1:18690`.
- Hermes profiles present at `/opt/cortexos/hermes/profiles.json`.

## CHECKPOINT 1

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:18690/health` return 200, and does `/opt/cortexos/hermes/profiles.json` exist?

```bash
curl -fsS http://127.0.0.1:18690/health
test -f /opt/cortexos/hermes/profiles.json && echo present || echo MISSING
```

Type `confirmed` to proceed.

## Configure

For every profile in `/opt/cortexos/hermes/profiles.json`, set:

- Honcho base URL: `http://127.0.0.1:18690`
- Honcho workspace: the profile slug
- AI peer identifier: `hermes-<profile-slug>`
- Session key format: `<profile-slug>:<role>:<issue-id>`

Use the Hermes configuration commands discovered during profile setup (see `40-hermes.md`).

**STOP — operator action required:** List the profile slugs from `profiles.json`, then confirm each one has been wired to its corresponding Honcho workspace before proceeding.

```bash
jq -r '.[].slug' /opt/cortexos/hermes/profiles.json
```

## Verify isolation

Create a test memory fact in workspace `primary` and confirm workspace `secondary` cannot retrieve it. Then create a test memory fact in `secondary` and confirm `primary` cannot retrieve it.

```bash
# STOP — operator question: does each workspace return only its own facts?
# Run isolation checks using the Hermes CLI or Honcho API for each profile pair.
```

Type `confirmed` to proceed after both isolation checks pass.

## CHECKPOINT 2

**STOP — operator question:** Does every Hermes profile show Honcho as its active memory backend, and does workspace isolation hold?

Type `confirmed` to proceed.

## Rollback

Revert each profile's memory config to its prior backend. No Honcho data is deleted by this step; use `docker compose down` in the Honcho stack if full removal is needed.

## Next

→ `prompts/tools/47a-cortex-sandbox.md`
