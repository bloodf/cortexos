# WP-51 — Parity verification
- **Wave:** 3   **Depends-on:** WP-01–WP-21 (all Wave 1 + Wave 2)   **Parallel-safe-with:** WP-50 (no shared files)
- **Owns (edit only these):** `docs/rebuild/PARITY.md` (create/overwrite)
- **Do NOT touch:** any source file in `packages/dashboard-next` or `packages/dashboard`; no code changes

## Objective

Produce a per-route checklist (`docs/rebuild/PARITY.md`) comparing every
dashboard-next route against the live legacy host at `http://127.0.0.1:3080`.
Log gaps as follow-up WP notes. This document is the human + agent audit trail
proving the new app matches the old one before WP-52 throws the switch.

## Read first

| File | Why |
|------|-----|
| `docs/rebuild/01-API-CONTRACT.md` | Frozen API shapes to verify against |
| `docs/rebuild/00-OVERVIEW.md` §Golden rules | Never fabricate data in verification |
| `packages/dashboard-next/src/routes/` (directory listing) | 37 routes to verify |
| `packages/dashboard/src/routes/(authed)/` (directory listing) | Legacy route list for cross-reference |

## Route inventory (37 routes)

The dashboard-next route file tree produces the following pages and API
endpoints. The checklist below maps each to the legacy equivalent and the
verification method.

### Auth routes (2)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `login.tsx` → `GET /login` | `(auth)/login/+page.svelte` | `curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3080/login` → 200 on both |
| `POST /api/auth/login` | `routes/api/auth/login/+server.ts` | POST with valid creds → cookie set; POST with bad creds → 401, same body shape for unknown user vs wrong pw |

### Shell / navigation (1)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.tsx` (layout + nav) | `(authed)/+layout.svelte` + `nav.ts` | Nav items render; unauthenticated redirect to `/login`; admin-only items hidden for non-admin |

### Overview (1)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.overview.tsx` | `(authed)/dashboard/+page.svelte` | Uptime, load, memory, disk widgets populated from `GET /api/system`; service count from `GET /api/services` |

### Apps + Healthcheck (2)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.apps.tsx` | `(authed)/apps/+page.svelte` | Services list from `GET /api/services`; empty-state when no services |
| `_authenticated.healthcheck.tsx` | `(authed)/healthcheck/+page.svelte` | Health snapshots from `GET /api/services/:id/health`; recheck button calls `POST` |

### Docker (2)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.docker.tsx` | `(authed)/docker/+page.svelte` | Container/image/volume lists from `GET /api/docker/{containers,images,volumes}`; no `<none>` image tags |
| `_authenticated.docker.$id.tsx` | `(authed)/docker/[id]/+page.svelte` | Container detail; action buttons (`start`,`stop`,`restart`) gated to admin; `rm` triggers approval flow |

### Incus (2)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.incus.tsx` | `(authed)/incus/+page.svelte` | Instance list from `GET /api/incus/instances`; matches `incus list --format=json` on host |
| `_authenticated.incus.$name.tsx` | `(authed)/incus/[name]/+page.svelte` | Detail + logs + exec-named; `delete` requires approval |

### Systemd (2)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.systemd.tsx` | `(authed)/systemd/+page.svelte` | Unit list from `POST /api/systemd/actions` (`action:list`); admin actions gated |
| `_authenticated.systemd.$unit.tsx` | `(authed)/systemd/[name]/+page.svelte` | Journal logs from `GET /api/systemd/:name/logs`; `restart cortex-dashboard.service` requires approval |

### System / Network / Processes / Storage / Terminal (5)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.network.tsx` | `(authed)/network/+page.svelte` | `GET /api/network` — **only physical NICs** (has `/sys/class/net/*/device` symlink); no loopback/bridge/veth |
| `_authenticated.storage.tsx` | `(authed)/storage/+page.svelte` | `GET /api/storage` — physical disks only; no tmpfs/overlay/loop |
| `_authenticated.processes.tsx` | `(authed)/processes/+page.svelte` | Process list from `GET /api/processes`; non-empty on live host |
| `_authenticated.terminal.tsx` | `(authed)/terminal/+page.svelte` | xterm connects to `GET /api/terminal` (WS upgrade); shell prompt appears; admin-only |
| `_authenticated.backups.tsx` | `(authed)/backups/+page.svelte` | Real empty-state or real data — NO mock data |

### Mail-Guardian (1)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.mail-guardian.tsx` | `(authed)/mail-guardian/+page.svelte` | Account list from `GET /api/mail-guardian/accounts`; reviews from `GET /api/mail-guardian/reviews`; flag/approve actions admin-gated |

### Approvals + Audit (2)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.approvals.tsx` | `(authed)/approvals/+page.svelte` | Pending queue from `GET /api/approvals`; grant/revoke buttons admin-only |
| `_authenticated.audit.tsx` | `(authed)/audit/+page.svelte` | Event list from `GET /api/audit`; verify button calls `GET /api/audit/verify`; chain `ok:true` displayed |

### Alerts (1)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.alerts.tsx` | `(authed)/alerts/+page.svelte` | Alert rules from `GET /api/alerts`; history from `GET /api/alerts/history`; CRUD admin-gated |

### Admin panel (8)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.admin.tsx` (layout) | `(authed)/admin/+layout.svelte` | Admin-only guard; non-admin → redirect or 403 |
| `_authenticated.admin.services.tsx` | `(authed)/services/+page.svelte` | Service CRUD from `/api/services`; PATCH/DELETE admin-only |
| `_authenticated.admin.users.tsx` | `(authed)/admin/` | User list from session store; read-only display |
| `_authenticated.admin.docker.tsx` | sub-page of admin | Docker action log / admin controls |
| `_authenticated.admin.incus.tsx` | sub-page of admin | Incus admin controls |
| `_authenticated.admin.systemd.tsx` | sub-page of admin | Systemd admin controls |
| `_authenticated.admin.env-browser.tsx` | sub-page of admin | Env file browser: masked by default; unlock button calls `POST /api/env-browser/unlock` with PAM password; cleartext shown only after grant |
| `_authenticated.admin.alerts.tsx` | `(authed)/alerts/rules/` | Alert rule CRUD |
| `_authenticated.admin.audit.tsx` | `(authed)/audit/` | Audit admin view |
| `_authenticated.admin.badges.tsx` | sub-page of admin | Badge management |
| `_authenticated.admin.projects.tsx` | sub-page of admin | Project management |
| `_authenticated.admin.account.tsx` | sub-page of admin | Account settings |

### Agents (1)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.agents.tsx` | `(authed)/agents/+page.svelte` | Agent list from `GET /api/agents`; profile cards populated from `profiles.json` |

### Other / misc (3)
| Route | Legacy equivalent | Verify method |
|-------|------------------|---------------|
| `_authenticated.scheduler.tsx` | `(authed)/scheduler/+page.svelte` | Real empty-state or real data; NO mock |
| `_authenticated.backups.tsx` | `(authed)/backups/+page.svelte` | Real empty-state or real data; NO mock |
| `index.tsx` → `/` | root redirect | Redirects to `/overview` (or `/login` if unauthed) |

## Steps

1. Stand up `packages/dashboard-next` dev server locally: `pnpm --filter @cortexos/dashboard-next dev`.
2. Ensure the live legacy host is serving at `http://127.0.0.1:3080` (do not restart it — it is the reference).
3. For each route in the table above:
   a. Hit the legacy URL and capture: HTTP status, key data fields, UI element presence (noted in prose).
   b. Hit the dashboard-next equivalent URL and capture the same.
   c. Record match/gap in `PARITY.md`.
4. For API routes: use `curl` with a valid session cookie to compare JSON shapes against `01-API-CONTRACT.md`.
5. For admin-gated routes: test with both an admin session and a non-admin session.
6. For env-browser: verify masked-by-default without PAM unlock.
7. For network/storage: confirm physical-only filtering on the live host.
8. Log any gaps as a `## Gaps` section in `PARITY.md` with severity (`blocker` / `minor`) and suggested follow-up WP.
9. Write `docs/rebuild/PARITY.md` using the template below.

## `PARITY.md` template

```markdown
# Dashboard Parity Report
_Generated: <ISO date>_  _Verified by: WP-51 agent_

## Summary
- Routes checked: 37
- Passing: N
- Gaps (blocker): N
- Gaps (minor): N

## Per-route checklist

| Route | Status | Notes |
|-------|--------|-------|
| GET /login | PASS | 200 on both; login form renders |
| POST /api/auth/login | PASS | Cookie set; 401 shape identical |
| ... | ... | ... |

## Gaps

### Blockers (must fix before WP-52)
- **[route]**: [description] — suggested fix: [WP or inline]

### Minor (can follow-up post-cutover)
- **[route]**: [description]
```

## Acceptance criteria

- [ ] `docs/rebuild/PARITY.md` exists and covers all 37 routes.
- [ ] Every row has a `PASS` or `GAP` status with a note.
- [ ] Blocker gaps are filed as follow-up items before WP-52 starts.
- [ ] No code changes anywhere — this WP is documentation only.
- [ ] `STATUS.md` updated: `WP-51 done — N/37 routes passing, M blockers`.

## Verification commands

```bash
# Confirm legacy host is up
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/login

# Confirm dashboard-next dev server is up
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/login

# Sample API parity check (requires a valid session cookie)
curl -s -H "Cookie: cortexos_session=<token>" http://127.0.0.1:3080/api/services | jq 'keys'
curl -s -H "Cookie: cortexos_session=<token>" http://127.0.0.1:5173/api/services | jq 'keys'

# Physical NIC filter check (network parity)
curl -s -H "Cookie: cortexos_session=<token>" http://127.0.0.1:5173/api/network | jq '[.interfaces[].name]'
ls /sys/class/net/*/device 2>/dev/null | sed 's|/sys/class/net/||;s|/device||'
```

## Notes / gotchas

- Do not curl `http://0.0.0.0:3080` — the live unit binds `127.0.0.1:3080`.
- The `_authenticated.backups.tsx` and `_authenticated.scheduler.tsx` routes have no backend WP; they should show a real empty-state. If they show mock data, that is a blocker gap.
- For the terminal route: a WebSocket parity check requires a browser; note it as "manual verify" if curl is not sufficient.
- If dashboard-next has not had its dev server tested end-to-end before this WP, coordinate with WP-52 agent — do not run `systemctl` commands to switch traffic; that is WP-52's job.
- The `stacks/cortex-dashboard/` docker-compose files are stale and must NOT be used for any verification.
