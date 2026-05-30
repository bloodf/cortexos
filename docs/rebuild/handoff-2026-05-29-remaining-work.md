# CortexOS Handoff — Remaining Work (2026-05-29)

**For:** next AI agent (tmux + SSH, subagent-decomposed)  
**Status:** Steps 1–4 of reconciliation plan **DONE** on host + repo  
**SSH:** `ssh -o BatchMode=yes cortexos@cortexos.tailfd052e.ts.net`

---

## 1. CONTEXT DUMP

### Host — Hermes profiles (DONE)

| Item | State |
|------|--------|
| Profiles on disk | `cortex`, `netbook`, `cieucpb` only |
| `default` / `primary` | archived under `/mnt/hdd/cortexos-backups/hermes-merge-*`, removed |
| `hermes-profile@cortex` | active — merged from `default` (honcho, telegram, whatsapp) |
| `mcp_servers` | stripped from all host + Incus profile configs |

Verify:

```bash
ls /opt/cortexos/hermes/profiles/
grep -rl mcp_servers /opt/cortexos/hermes/profiles/*/config.yaml || echo OK
systemctl is-active hermes-profile@cortex hermes-profile@netbook hermes-profile@cieucpb
```

### Host — Caddy (DONE)

| Item | State |
|------|--------|
| `/etc/caddy/Caddyfile` | `:80` → `reverse_proxy localhost:3080` only |
| Backup | `/etc/caddy/Caddyfile.pre-simplify-20260529` |
| Health | `curl http://127.0.0.1:80/en/login` → 200 |

**DO NOT** re-add Caddy subpaths. Use native ports + Tailscale Serve.

### Host — Obot (partial)

| Item | State |
|------|--------|
| `cortex-obot` | `127.0.0.1:8090` |
| Tailscale Serve | DONE (`8090 → 8090`) |
| Bootstrap | TODO (operator) |

### Incus

| Instance | tailscale |
|----------|-----------|
| mementry, celebrar-me, 3guns | Logged out — join in T1 |

### Repo (DONE)

- Migrations: `001_schema.sql`, `002_seed.sql` only
- 570 tests, tsc, build green

---

## 2. SSH

```bash
export CORTEX_SSH="ssh -o BatchMode=yes cortexos@cortexos.tailfd052e.ts.net"
```

---

## 3. TASKS

### T1 — Incus Tailscale (parallel ×3)

Key: `/opt/cortexos/.secrets/tailscale/incus-projects.authkey`

```bash
AUTHKEY="$(sudo cat /opt/cortexos/.secrets/tailscale/incus-projects.authkey)"
incus exec INSTANCE -- cortex-tailscale-up "$AUTHKEY" --hostname=HOSTNAME
```

| Instance | hostname |
|----------|------------|
| mementry | mementry |
| celebrar-me | celebrar-me |
| 3guns | 3guns |

**STOP:** Logged in on all three. **MAX RETRIES:** 3.  
**Runbook:** `docs/rebuild/incus-tailscale-provision.md`

### T2 — Dashboard host rebuild
```bash
# From laptop (host is not a git repo):
git archive --format=tar HEAD packages/ stacks/ scripts/ templates/ schemas/ prompts/ docs/ | \
  ssh cortexos@cortexos.tailfd052e.ts.net 'cd /opt/cortexos && tar xf - --overwrite'
# On host:
ssh cortexos@cortexos.tailfd052e.ts.net '
  cd /opt/cortexos/stacks/cortex-dashboard
  docker compose build --no-cache
  docker compose down
  docker compose up -d
  sleep 15
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/en/login
'
```
**STOP:** login page HTTP 200. **MAX RETRIES:** 3.

### T3 — Obot bootstrap (operator)

`tailscale serve --bg 8090 http://127.0.0.1:8090`; browser + `OBOT_BOOTSTRAP_TOKEN`.  
**STOP:** Obot UI; agentgateway stopped. **MAX RETRIES:** 2.

### T4 — Systemd unit drift (C4)

Redeploy changed units; `daemon-reload`. **MAX RETRIES:** 3.

### T5 — Docker volume cleanup (C3)

Operator confirm before `docker volume rm`. **MAX RETRIES:** 1.

### T6 — E2E health

After T1/T2/T4. Dashboard API + key ports + Incus Hermes.

---

## 4. SUBAGENT DECOMPOSITION

| Wave | Tasks |
|------|-------|
| 1 | T1 × 3 parallel |
| 2 | T2 + T4 parallel |
| 3 | T3 operator |
| 4 | T5 confirm |
| 5 | T6 verify |

---

## 5. DO NOT

- No Caddy subpaths (port 80 = dashboard only)
- No `mcp_servers` in Hermes
- No default/primary profiles
- No migrations 003–027 restore
- No Incus via host hop
- No `docker volume rm` without operator OK

---

## 6. RELATED

- `docs/rebuild/network-access-and-remaining-work.md`
- `docs/rebuild/incus-tailscale-provision.md`
- `prompts/tools/50-obot.md`

---

## 7. PLAN CHECKLIST

- [x] Hermes merge + MCP strip
- [x] Caddy simplify
- [x] Migration squash
- [x] Tests / tsc / build
- [x] Handoff doc
- [x] Commit + push
