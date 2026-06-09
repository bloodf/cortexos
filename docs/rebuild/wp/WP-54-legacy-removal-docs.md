# WP-54 — Legacy removal + docs
- **Wave:** 4   **Depends-on:** WP-52 (cutover complete)   **Parallel-safe-with:** WP-53
- **Owns (edit only these):**
  - `packages/dashboard/` — full directory deletion
  - `stacks/cortex-dashboard/` — full directory deletion (retired docker-compose stack)
  - `prompts/tools/70-dashboard.md` — rewrite for TanStack/React reality
  - Root `CLAUDE.md` and `AGENTS.md` — update dashboard section
  - `packages/dashboard/CLAUDE.md` and `packages/dashboard/AGENTS.md` — deleted with the directory
- **Do NOT touch:** `packages/dashboard-next/` (live app); `templates/systemd/cortex-dashboard.service` (already updated by WP-52); `packages/contracts/` (shared); any other package

## Objective

Remove all dead code and stale documentation left by the legacy SvelteKit
dashboard, retire the docker-compose stack placeholder, and update every
AI-facing prompt/doc to reflect the TanStack Start / React 19 reality so future
agents get accurate context from day one.

**Hard prerequisite:** WP-52 must be marked done in `STATUS.md` AND
`http://127.0.0.1:3080/login` must return 200 from `dashboard-next` before any
deletion step is executed.

## Read first

| File | Why |
|------|-----|
| `prompts/tools/70-dashboard.md` | Rewrite target — currently describes SvelteKit build, wrong WorkingDirectory, wrong `ExecStart` |
| `packages/dashboard/CLAUDE.md` | Deleted with directory — read to extract still-valid facts to preserve in root docs |
| `packages/dashboard/AGENTS.md` | Deleted with directory — same |
| `stacks/cortex-dashboard/README.md` | Check for any still-valid operational notes before deleting |
| `docs/rebuild/00-OVERVIEW.md` | End-state architecture to reference in rewritten docs |
| `docs/rebuild/02-CONVENTIONS.md` | Coding standards and layout to reference |
| `templates/systemd/cortex-dashboard.service` | Current (post-WP-52) template — use for accurate deploy docs |

## Steps

### Phase 1 — Verify cutover before touching anything

```bash
# Confirm WP-52 is done
grep "WP-52" /opt/cortexos/docs/rebuild/STATUS.md | grep done

# Confirm the live service is running dashboard-next
grep ExecStart /etc/systemd/system/cortex-dashboard.service
# Must show: ...dashboard-next/.output/server/index.mjs

# Confirm :3080 is serving
curl -fsS -o /dev/null -w 'live: %{http_code}\n' http://127.0.0.1:3080/login
# Must print: live: 200

# Confirm legacy build still exists (for rollback — do NOT delete yet)
ls /opt/cortexos/packages/dashboard/build/index.js
```

If any check fails, stop. Do not proceed until WP-52 is verified complete.

### Phase 2 — Retire the docker-compose stack

```bash
# Confirm no live containers are using this compose file
docker compose -f /opt/cortexos/stacks/cortex-dashboard/docker-compose.yml ps 2>/dev/null || true

# Delete the stale stack directory
rm -rf /opt/cortexos/stacks/cortex-dashboard/
```

`stacks/cortex-dashboard/` contains:
- `docker-compose.yml` — never used in production (unit runs natively)
- `docker-compose.yml.bak-20260529T181428` — stale backup
- `docker-compose.yml.retired` — already retired
- `README.md` — stale

### Phase 3 — Delete the legacy dashboard package

```bash
# Final check: the live service does NOT reference this directory
grep WorkingDirectory /etc/systemd/system/cortex-dashboard.service
# Must show dashboard-next, not dashboard

# Remove the legacy SvelteKit package
rm -rf /opt/cortexos/packages/dashboard/
```

This deletes:
- All SvelteKit source (`src/`) — ~70k lines
- `build/` (legacy node output — rollback window closes here; confirm with ops)
- `migrations/` (already ported to `packages/dashboard-next/migrations/` by WP-02)
- `CLAUDE.md`, `AGENTS.md` (superseded by root docs update below)
- `node_modules/` symlinks (resolved at workspace root)

**Rollback note:** once `build/index.js` is deleted, the sub-60-second legacy
rollback path closes. Ensure the team has confirmed dashboard-next is stable
(at least 24h uptime recommended) before executing Phase 3.

### Phase 4 — Rewrite `prompts/tools/70-dashboard.md`

Replace the file entirely with content that reflects the TanStack/React reality.
Key facts to include:

**Runtime model (accurate post-cutover):**
- Unit: `cortex-dashboard.service` (template `templates/systemd/cortex-dashboard.service`)
- `WorkingDirectory=/opt/cortexos/packages/dashboard-next`
- `ExecStart=/usr/bin/node .output/server/index.mjs`
- Runs as `root`; `HOST=127.0.0.1`; `PORT=3080`; `EnvironmentFile=/opt/cortexos/.secrets/dashboard.env`

**Stack (accurate):**
- TanStack Start + React 19 + Vite 7 + shadcn/ui + Tailwind v4
- TanStack Router (file-based, `src/routes/`)
- TanStack Query for data fetching
- Nitro `node-server` preset
- Recharts for charts; xterm.js for terminal
- Same Postgres DB (`cortex_dashboard`), same Drizzle schema, same migrations

**Auth (unchanged):**
- Linux PAM (`authenticate-pam` native binding, runs as root)
- `cortexos-admin` group → admin; no DB-stored passwords
- Session: DB-backed (`admin_sessions`/`pam_users`); 30d rolling expiry
- CSRF: double-submit (`cortexos_session` + `cortexos_csrf` cookies)

**Build and deploy (accurate):**
```bash
cd /opt/cortexos
pnpm install --frozen-lockfile
pnpm --filter @cortexos/contracts build
pnpm --filter @cortexos/dashboard-next build
# Output: packages/dashboard-next/.output/server/index.mjs
sudo systemctl restart cortex-dashboard.service
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/login  # 200
```

**Source layout:**
```
packages/dashboard-next/
  src/
    routes/        TanStack file-based UI routes + api/ server routes
    server/        ported backend: db, auth, bridges, health, ...
    i18n/          en.ts, es.ts, ptBR.ts
    lib/api/       typed fetch + react-query client
    lib/adapters/  @cortexos/contracts → component props
  migrations/      same SQL as legacy, applied by scripts/migrate-cli.js
```

**Rules to preserve from legacy docs (still valid):**
- Never commit credentials or `.env` files.
- Binds loopback `127.0.0.1:3080`; Caddy reverse-proxies TLS.
- Admin access: add OS user to `cortexos-admin` group; log in normally.
- Rotate `CORTEX_MASTER_KEY`: edit `.secrets/dashboard.env` → `systemctl restart`.
- No container, no Docker Compose, no image.

**Remove from the rewritten file:**
- All SvelteKit/Svelte references.
- `WorkingDirectory=.../packages/dashboard` (old path).
- `ExecStart=.../build/index.js` (old output).
- Any reference to `stacks/cortex-dashboard/`.
- The `pnpm run dev` / `pnpm run check` / `svelte-check` commands (wrong package).
- The prerequisite checkpoint about `packages/dashboard` source tree.

### Phase 5 — Update root `CLAUDE.md` and `AGENTS.md`

Locate the dashboard section in each file (search for `cortex-dashboard` or `packages/dashboard`). Update:
- Replace `packages/dashboard` paths with `packages/dashboard-next`.
- Replace `SvelteKit` / `Svelte 5` references with `TanStack Start` / `React 19`.
- Replace `build/index.js` with `.output/server/index.mjs`.
- Remove any reference to `stacks/cortex-dashboard/`.
- Keep all non-dashboard content unchanged.

### Phase 6 — Clean up pnpm workspace (if applicable)

```bash
# Check if packages/dashboard is listed in pnpm-workspace.yaml
grep "packages/dashboard" /opt/cortexos/pnpm-workspace.yaml

# If present (and packages/dashboard is now deleted), remove that line
# pnpm will error on next install if it references a non-existent package
pnpm install --frozen-lockfile 2>&1 | head -20
# Fix any workspace errors
```

### Phase 7 — Final verification

```bash
# Service still running after all deletions
systemctl is-active cortex-dashboard.service
curl -fsS -o /dev/null -w 'final: %{http_code}\n' http://127.0.0.1:3080/login

# No stale references to old paths in systemd
grep -r "packages/dashboard[^-]" /etc/systemd/system/ 2>/dev/null || echo "clean"

# pnpm workspace is clean
pnpm install --frozen-lockfile 2>&1 | grep -i error || echo "workspace clean"
```

## Acceptance criteria

- [ ] `packages/dashboard/` does not exist.
- [ ] `stacks/cortex-dashboard/` does not exist.
- [ ] `prompts/tools/70-dashboard.md` describes TanStack/React, correct `ExecStart`, correct `WorkingDirectory`, accurate build commands.
- [ ] Root `CLAUDE.md` and `AGENTS.md` dashboard sections reference `packages/dashboard-next`.
- [ ] `systemctl is-active cortex-dashboard.service` prints `active`.
- [ ] `curl http://127.0.0.1:3080/login` returns 200.
- [ ] `pnpm install --frozen-lockfile` succeeds (no missing workspace package errors).
- [ ] No grep hits for `packages/dashboard[^-]` in `/etc/systemd/system/` or active tool prompts.
- [ ] `STATUS.md` updated: `WP-54 done`.

## Verification commands

```bash
# Deletions complete
[ -d /opt/cortexos/packages/dashboard ] && echo STILL_EXISTS || echo DELETED
[ -d /opt/cortexos/stacks/cortex-dashboard ] && echo STILL_EXISTS || echo DELETED

# Live service
systemctl is-active cortex-dashboard.service
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/login

# No stale path references in systemd
grep -r "packages/dashboard[^-n]" /etc/systemd/system/cortex-dashboard.service || echo "clean"

# Docs updated
grep -c "TanStack\|dashboard-next" /opt/cortexos/prompts/tools/70-dashboard.md
grep -c "SvelteKit\|build/index.js" /opt/cortexos/prompts/tools/70-dashboard.md
# First count should be >0; second count should be 0
```

## Notes / gotchas

- **Execute Phase 3 (rm -rf packages/dashboard) only after at least 24h of stable production traffic on dashboard-next.** The rollback path (reverting WP-52 + restoring the build) becomes manual once the directory is gone.
- The `scripts/migrate-cli.js` at the root level references the DB, not the dashboard package — it is unaffected. Do not delete it.
- `packages/contracts/` is a separate package used by both legacy and dashboard-next — do NOT touch it.
- The `authenticate-pam` native binding is a workspace dep resolved at the root `node_modules/` — it survives the package deletion.
- After deleting `packages/dashboard`, run `pnpm install` once to let pnpm prune orphaned hoisted modules. Some packages that were only used by the legacy app will be removed from `node_modules/` — this is expected and correct.
- If any other tool prompt or AGENTS.md file in the repo references `packages/dashboard`, update it. Run: `grep -r "packages/dashboard[^-]" /opt/cortexos/prompts/ /opt/cortexos/CLAUDE.md /opt/cortexos/AGENTS.md 2>/dev/null` to find stragglers.
