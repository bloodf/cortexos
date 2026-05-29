# CortexOS Network Access Model & Remaining Work

Created: 2026-05-29  
Status: **ACTIVE** — operator decision recorded during reconciliation execution

## Operator decision (2026-05-29)

**Stop using Caddy for reverse-proxy path routing.** Access model going forward:

1. **Host services / webapps** — reach each service on its **native port** (loopback bind + Tailscale Serve per port where needed).
2. **Incus project instances** — each instance runs **Tailscale inside the container**, gets its **own tailnet IP**, and is accessed directly (SSH/HTTPS/app ports on that IP).
3. **No new Caddy subpaths** (`/obot`, `/grafana`, etc.) for new work. Existing Caddy `:8080` block may remain until retired, but it is **not** the target architecture.

### What was reverted on the live host

- Caddy `/obot/*` route added during D2 deployment was **removed** (restored from `/etc/caddy/Caddyfile.pre-obot-20260529`).

---

## Service access matrix (target)

| Service | Loopback port | Tailscale Serve (tailnet) | Notes |
|---------|---------------|---------------------------|-------|
| Cortex Dashboard | `127.0.0.1:3080` | `443 → 3080` (already) | Primary UI |
| Obot MCP gateway | `127.0.0.1:8090` | `8090 → 8090` (done) | Replaces agentgateway `:18800` |
| 9Router | `127.0.0.1:11434` | `11434` (already) | |
| Grafana | `127.0.0.1:3000` | `3000` (already) | |
| Prometheus | `127.0.0.1:9090` | `9090` (already) | Cockpit moved to `:9091` |
| Honcho API | `127.0.0.1:18690` | `18690` (already) | |
| Incus project instances | instance loopback | **own tailnet machine each** | `mementry`, `celebrar-me`, `3guns` — not via `cortexos` |

### Access split (host vs project)


| You want… | Connect to… | Not… |
|-----------|-------------|------|
| Dashboard, Obot, Grafana, shared DB/AI | `cortexos` tailnet machine | — |
| mementry / celebrar / 3guns Hermes + apps | **`mementry` / `celebrar-me` / `3guns`** tailnet machines | `cortexos` host hop |

Project instances are **separate Tailscale nodes** (see P0 below). Incus bridge `10.222.222.x` is internal plumbing only.


---

## Completed in this session (repo)

- [x] OSS stale-reference cleanup (agentgateway → obot in manifests/docs where appropriate)
- [x] Migration `027_exporter_catalog.sql` (snmp-exporter, adguard-exporter)
- [x] Dashboard Incus management pages + API routes + tests
- [x] Local verification: 570 tests, tsc, production build, `validate.sh --local`

## Completed on live host (2026-05-29)

- [x] Obot PostgreSQL database `obot` + user + **pgvector** (built from source into `cortex-postgresql` container)
- [x] Obot stack deployed: `cortex-obot` on `127.0.0.1:8090`, attached to `cortex-db` network
- [x] `/opt/cortexos/.secrets/obot.env` created
- [x] Caddy obot subpath **reverted** per operator direction
- [x] Incus instances confirmed RUNNING: `mementry`, `celebrar-me`, `3guns`

---

## Remaining work (ordered)
### P0 — Per-instance Tailnet machines (operator priority)

**Requirement:** each project Incus instance (`mementry`, `celebrar-me`, `3guns`) is its **own machine** in Tailscale. Project SSH/Hermes/apps are reached on **that** tailnet node — **not** via the Cortex host.

| Step | Status | Notes |
|------|--------|-------|
| Base image has `tailscale` + `cortex-tailscale-up` | **DONE** | `stacks/cortex-incus/` |
| Live instances: `tailscaled` running | **DONE** | verified 2026-05-29 |
| Live instances: joined to tailnet | **TODO** | all three show `Logged out` |
| Tailscale admin shows 3 project machines | **TODO** | separate from `cortexos` |
| Hermes health via instance hostname | **TODO** | ports 18697 / 18696 / 18695 |

**Runbook:** `docs/rebuild/incus-tailscale-provision.md`


### P1 — Obot cutover (host)
| Step | Status | Blocker / notes |
|------|--------|-----------------|
| Tailscale Serve `8090 → 127.0.0.1:8090` | **DONE** | confirmed via `tailscale serve status` |
| Verify Obot UI/API on tailnet `:8090` | **TODO** | Root `/` returns 404 until bootstrap |
| Bootstrap / admin login | **TODO** | `OBOT_BOOTSTRAP_TOKEN` set; operator browser required |
| Register 7 global MCP servers (allowlist) | **TODO** | Needs Obot API docs or UI walkthrough |
| Stop + disable `cortex-agentgateway` | **DONE** | unit files removed, port 18800 free |
| Update Hermes `config.yaml`: remove `agentgateway` MCP | **DONE** | all profiles clean on host + Incus |

### P2 — Hermes MCP filesystem (host + Incus)

**DONE** — all `mcp_servers` stripped from host and Incus profile configs.

### P3 — Dashboard deploy (host)

- Sync repo to `/opt/cortexos` via `git archive | tar` (host is not a git repo)
- Rebuild/restart dashboard container (migrate + dynamic-seed)
- Verify squashed migrations + `/en/incus` page

### P4 — C4/C3 follow-ups

- Systemd unit drift redeploy
- Orphan Docker volumes (operator confirmation)

---

## Open questions

1. Obot MCP registration API — REST/UI steps for allowlist servers.
2. Hermes → Obot bridge vs direct stdio MCP in Hermes.
3. Per-Incus Tailscale auth and IP inventory.
4. Caddy retirement timeline.
5. Version `/opt/cortexos` as git clone vs rsync.
6. pgvector persistence across Postgres image rebuilds.

---

## Commands reference

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8090/api/
sudo tailscale serve --bg 8090 http://127.0.0.1:8090
sudo systemctl stop cortex-agentgateway && sudo systemctl disable cortex-agentgateway
sudo systemctl restart hermes-profile@netbook
incus exec mementry -- systemctl restart hermes-profile@mementry
```
