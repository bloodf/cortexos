@AGENTS.md

# CortexOS Dashboard (dashboard-next)

TanStack Start + React 19 + Vite control dashboard for CortexOS. Live on
`cortex-dashboard.service` at `:3080`. Package: `@cortexos/dashboard-next`.

## Stack

- **Framework:** TanStack Start (`@tanstack/react-start@1.168`) + TanStack Router (file-based, `src/routes/`)
- **UI:** React 19 + shadcn/ui + Tailwind v4 + Recharts + xterm.js
- **Data fetching:** TanStack Query
- **Build:** Vite 7 + Nitro `node-server` preset → `.output/server/index.mjs`
- **Testing:** Vitest 4
- **Transport:** `createServerFn` RPC only — NO REST `/api/*` routes (see ADR-001)

## Build & Deploy

```bash
cd /opt/cortexos
pnpm install --frozen-lockfile
pnpm --filter @cortexos/contracts build
pnpm --filter @cortexos/dashboard-next build
# Output: packages/dashboard-next/.output/server/index.mjs

sudo systemctl restart cortex-dashboard.service
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/login  # 200
```

## Runtime model

- Unit: `cortex-dashboard.service` (template `templates/systemd/cortex-dashboard.service`)
- `WorkingDirectory=/opt/cortexos/packages/dashboard-next`
- `ExecStart=/usr/bin/node .output/server/index.mjs`
- `User=root`, `HOST=127.0.0.1`, `PORT=3080`
- `EnvironmentFile=/opt/cortexos/.secrets/dashboard.env` (mode `0600`)

## Transport: createServerFn RPC

All backend communication is typed `createServerFn` RPC — there are **no**
`/api/*` HTTP routes. Server functions live in `src/lib/api/<domain>.functions.ts`
and are called directly from loaders/components:

```ts
// src/lib/api/<domain>.functions.ts  (client-importable)
import { createServerFn } from '@tanstack/react-start';
import { defineServerFn, serverFnNoop } from '@/lib/api/define-server-fn';
import { z } from 'zod';

const gate = defineServerFn({
  method: 'GET',          // 'GET' | 'POST'
  auth: 'any',            // 'public' | 'any' | 'admin' | GroupName
  input: z.object({ q: z.string().optional() }),
  surface: 'domain',
  action: 'domain.action',
  handler: async ({ input }) => {
    const { repo } = await import('@/server/domain/repo');  // DYNAMIC import
    return repo(input.q);
  },
});
export const listThings = createServerFn({ method: 'GET' })
  .middleware([gate])
  .handler(serverFnNoop);

// Frontend call (no fetch):
// const data = await listThings({ data: { q: 'foo' } });
```

Hard rules:
1. `createServerFn(...).middleware([gate]).handler(serverFnNoop)` MUST be a
   top-level variable assignment — the compiler enforces this.
2. Never static-import `src/server/**` at the top of a `*.functions.ts` file.
   Always use `await import('@/server/...')` inside the handler.
3. POST mutations are CSRF-enforced (double-submit; session-bound token).
4. Throw typed `ApiError`s from `@/server/errors`; the pipeline maps them to
   the contract envelope + HTTP status automatically.

## Source layout

```
src/
  routes/           TanStack file-based UI routes + loaders
  server/           server-only: db, auth, bridges, health, policy, ...
  lib/
    api/            <domain>.functions.ts + define-server-fn.ts
    adapters/       @cortexos/contracts → component props
  i18n/             en.ts, es.ts, ptBR.ts
migrations/         SQL migrations; runner: src/server/db/migrate.ts
.output/            Nitro build output (gitignored)
```

## Security gate pipeline

`resolveContext` → method → input (400) → auth/RBAC (401/403) →
CSRF on mutations (403/401) → rate-limit (429) → approval (412) →
handler → audit → typed envelope.

Reference: `src/lib/api/define-server-fn.ts`

## Database

- PostgreSQL `cortex_dashboard` at `127.0.0.1:5432`, user `dashboard`
- Migrations: `migrations/NNN_description.sql` (lexical order)
- Runner: `src/server/db/migrate.ts` (`runSqlMigrations`, in-process at
  startup; `defaultMigrationsDir()` = `cwd/migrations`). `scripts/migrate-cli.js`
  does not exist; root `scripts/migrate.js` is retired.
- Ledger: `dashboard_migrations` (namespaced, checksum-verified) —
  `(id, name UNIQUE, checksum CHAR(64), applied_at)`. Checksum =
  `sha256(raw file content)`. The runner records names automatically.
- Lineage: a SHARED legacy `migrations` table holds historical
  mixed-lineage rows (root / SvelteKit / dashboard-next) with colliding bare
  prefixes; it is NO longer the dashboard-next source of truth. First run
  reconciles `dashboard_migrations` from it (only this dir's names) so a
  fully-applied prod DB transitions without re-running migrations; content
  drift on an applied file triggers a `console.warn` and is not re-applied.
- New migrations need no trailing `INSERT INTO migrations ...` footer (the
  runner records into `dashboard_migrations`); such a footer is legacy/no-op,
  redundant but harmless.

## Auth

- Linux PAM (`authenticate-pam` native binding, root)
- `cortexos-admin` group → admin; no DB-stored passwords
- Sessions: DB-backed, 30-day rolling expiry
- CSRF: `cortexos_session` (HttpOnly) + `cortexos_csrf` (JS-readable)

## Testing

```bash
pnpm --filter @cortexos/dashboard-next test          # vitest run (all)
pnpm --filter @cortexos/dashboard-next typecheck     # tsc --noEmit
```

Server-fn gate tests live in `src/lib/api/__tests__/`. They drive the real
pipeline through the node-env test harness (not bare `fn()` invocation, which
skips the Nitro/Vite handler extraction).

## Rules

- Never commit credentials, `.env`, or `dashboard.env`.
- Binds loopback `127.0.0.1:3080`; Caddy reverse-proxies TLS.
- Admin access: OS user in `cortexos-admin` group.
- Rotate `CORTEX_MASTER_KEY`: edit `.secrets/dashboard.env` → `systemctl restart`.
- No container, no Docker Compose, no image.
