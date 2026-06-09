# Rebuild Status Ledger

> Agents: update your WP's row when you START (status `wip`, set Owner) and FINISH (status
> `done`, add the commit SHA). One line per WP. Do not start a WP whose Depends-on is not
> `done`. Legend: `todo` · `wip` · `blocked` · `done`.

## Done before this board
- Phase 0 foundation (sys-pilot vendored, pnpm, green build) — commit `f6a5ce5`
- API foundation (legacy backend hardened = the API to port) — commit `57a06d3`

## Wave 0 — foundation (sequential)
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-00 | node-server preset + runtime boot | — | done | claude | (pending) |
| WP-02 | DB port | — | done | claude | (this commit) |
| WP-03 | security cores (portable) | WP-02 | done | claude | (this commit) |
| WP-01 | request core → defineServerFn middleware (see ADR-001) | WP-02, WP-03 | wip | claude | logic ported; transport rework |
| WP-04 | frontend client → RPC facades (see ADR-001) | — (contract) | wip | claude | scaffolding done; RPC rework |

> **TRANSPORT CORRECTION — read `ADR-001-server-transport.md`.** The framework
> (`@tanstack/react-start@1.168`) has NO REST/HTTP server routes — only `createServerFn` RPC.
> WP-01 (defineApiRoute/`/api/*`) and WP-04 (fetch client) are reworked onto server fns; the
> `01`/`02` REST framing and all Wave-1/2 specs are amended to RPC. **Fan-out of Waves 1 & 2
> is PAUSED until WP-01/WP-04 are re-proven on the corrected transport.** WP-00/02/03 stand.

### TanStack `/api` route convention (Wave 0 — follow this in Wave 1)
This installed version (`@tanstack/react-start` ^1.167, `@tanstack/react-router` ^1.170,
`start-client-core` 1.170, `router-core` 1.171) has **no** `createServerFileRoute` /
`ServerRoute` export. Server (HTTP) routes are declared on a normal **file route** via the
`server.handlers` option that `@tanstack/start-client-core/serverRoute` augments onto
`FilebaseRouteOptionsInterface`:

```ts
// src/routes/api/<domain>/<name>.ts
import { createFileRoute } from '@tanstack/react-router';
import { defineApiRoute } from '@/server/define-api-route';

const core = defineApiRoute({ methods: ['GET','POST'], auth: 'admin', /* ... */ handler });

export const Route = createFileRoute('/api/<domain>/<name>')({
  server: {
    handlers: {
      GET:  ({ request }: { request: Request }) => core(request),
      POST: ({ request }: { request: Request }) => core(request),
    },
  },
});
```

- Each method handler receives `{ request: Request, params, pathname, context, next }` and
  returns `Response | Promise<Response>`. `defineApiRoute` IS the framework-agnostic core
  (`(request: Request) => Promise<Response>`); the route file just wires it into
  `server.handlers` per HTTP method.
- The TanStack Router generator scans `src/routes/api/**` and registers paths in
  `routeTree.gen.ts` on the next dev/build pass. For a brand-new route file whose path is not
  yet in the generated registry, call `createFileRoute()` **path-less** (the generator
  rewrites it to `createFileRoute('/api/...')`) so `tsc` stays green until generation runs —
  see `src/routes/api/_ping.ts` for the reference.
- Reference implementation + full pipeline docs: top of
  `src/server/define-api-route.ts`. Demo route: `src/routes/api/_ping.ts`.

## Wave 1 — backend domains (PARALLEL; need WP-01+WP-02)
| WP | Title | Extra deps | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-10 | api services + health | — | todo | | |
| WP-11 | api docker | — | todo | | |
| WP-12 | api incus | — | todo | | |
| WP-13 | api systemd | — | todo | | |
| WP-14 | api system/net/proc/storage | — | todo | | |
| WP-15 | api mail-guardian | — | todo | | |
| WP-16 | api approvals + audit | WP-03 | todo | | |
| WP-17 | api alerts | — | todo | | |
| WP-18 | api env-browser | WP-03 | todo | | |
| WP-19 | api terminal (WS PTY) | — | todo | | |
| WP-20 | api auth | WP-03 | todo | | |
| WP-21 | api agents | — | todo | | |

## Wave 2 — frontend route-groups (PARALLEL; need WP-04)
| WP | Title | Pairs with | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-30 | shell/nav/auth/login | WP-20 | todo | | |
| WP-31 | overview | WP-10,14 | todo | | |
| WP-32 | apps + healthcheck | WP-10 | todo | | |
| WP-33 | docker | WP-11 | todo | | |
| WP-34 | incus + wizard | WP-12 | todo | | |
| WP-35 | systemd | WP-13 | todo | | |
| WP-36 | system/net/storage/proc/terminal | WP-14,19 | todo | | |
| WP-37 | mail-guardian | WP-15 | todo | | |
| WP-38 | approvals + audit | WP-16 | todo | | |
| WP-39 | alerts | WP-17 | todo | | |
| WP-40 | admin | WP-10,18 | todo | | |
| WP-41 | agents | WP-21 | todo | | |

## Wave 3 — verify & cutover (sequential)
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-50 | security test suite (GATE) | all Wave 1 | todo | | |
| WP-51 | parity verification | all W1+W2 | todo | | |
| WP-52 | build + systemd cutover | WP-50, WP-51 | todo | | |

## Wave 4 — post-cutover
| WP | Title | Depends-on | Status | Owner | Commit |
|----|-------|-----------|--------|-------|--------|
| WP-53 | i18n es/pt-br | WP-52 | todo | | |
| WP-54 | legacy removal + docs | WP-52 | todo | | |
