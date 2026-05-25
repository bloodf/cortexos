# Final Validation

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

Purpose: prove the installed machine matches the public-safe CortexOS runtime
contract.

## Runtime Checks

```bash
set -euo pipefail

systemctl --failed --no-pager

set -a
source /opt/cortexos/.secrets/9router.env
set +a

curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  "${NINEROUTER_BASE_URL%/}/v1/models" | jq -e '.data | length > 0'

curl -fsS http://127.0.0.1:18690/health
curl -fsS http://127.0.0.1:18691/health
curl -fsS http://127.0.0.1:18692/health
curl -fsS http://127.0.0.1:3033/api/health
curl -fsS http://127.0.0.1:3034/api/health
curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3080/en/login
```

Expected:

- No failed systemd units.
- 9Router returns at least one model.
- Honcho, baseline Hermes profiles, Paperclip, and dashboard respond locally.

## Repository Gates

```bash
rtk pnpm check:repo-leaks
rtk pnpm audit:docker-names
rtk pnpm audit:runtime-sync -- --strict
rtk pnpm --filter cortexos-scripts test
rtk pnpm --filter @cortexos/dashboard test
```

Expected: all pass.

## Public-Safety Gate

The repository must not contain tokens, provider keys, private hostnames,
private project names, channel IDs, generated profile state, Paperclip data,
Honcho data, or machine logs. Dashboard migrations may include generic
loopback endpoints and `/opt/cortexos` paths only.

## Paperclip Clean-State Check

For a fresh machine:

```bash
psql "${PAPERCLIP_DB_URL:-postgres://paperclip:paperclip@127.0.0.1:54329/paperclip}" \
  -v ON_ERROR_STOP=1 -At \
  -c "select json_build_object('issues',(select count(*) from issues),'runs',(select count(*) from heartbeat_runs),'comments',(select count(*) from issue_comments));"
```

Expected before real work: zero issues, zero runs, zero comments.
