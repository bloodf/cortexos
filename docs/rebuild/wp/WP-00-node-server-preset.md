# WP-00 — Nitro node-server preset + runtime boot
- **Wave:** 0   **Depends-on:** none   **Parallel-safe-with:** WP-02, WP-03, WP-04
- **Owns (edit only these):** `packages/dashboard-next/vite.config.ts`, `packages/dashboard-next/src/server/runtime.ts` (new), `packages/dashboard-next/src/start.ts` (boot hook only — see Steps), `docs/rebuild/DEPLOY.md` (new)
- **Do NOT touch:** any `packages/dashboard/**` (legacy), `src/router.tsx`, `src/server.ts` (the SSR error wrapper — leave its body alone), `src/routes/**`, `src/server/db|auth|...` owned by other WPs.

## Objective
Make `pnpm --filter @cortexos/dashboard-next build` emit a runnable **Node** server (Nitro `node-server` preset) instead of the default Cloudflare output, and add a single boot-time hook point (`src/server/runtime.ts`) where Wave-1 WP-10 will later start the health scheduler. Done = `node <built-entry>` serves the stock app on a port, and `DEPLOY.md` documents the exact build + run commands.

## Read first
- `packages/dashboard-next/vite.config.ts` — current config; wraps `tanstackStart` + `nitro` via `@lovable.dev/vite-tanstack-config`.
- `packages/dashboard-next/package.json` — confirms `nitro@3.0.260429-beta` and `@lovable.dev/vite-tanstack-config@^2.1.1` are installed.
- `packages/dashboard-next/src/server.ts` and `src/start.ts` — existing TanStack Start server entry + request middleware (do not break these).
- The lovable config source: `packages/dashboard-next/node_modules/@lovable.dev/vite-tanstack-config/dist/index.js` lines ~347–386. KEY FACTS:
  - The plugin only runs Nitro on `command === 'build'` AND (`explicitNitro` OR `isSandbox`). `explicitNitro` is true when `nitro` is `true` or an object.
  - It defaults `defaultPreset: 'cloudflare-module'`; a user `nitro: { preset: '...' }` overrides it.
  - Outside a sandbox with `nitro === undefined`, Nitro is SKIPPED entirely (logs `skipping nitro deploy plugin`). So you MUST pass an explicit `nitro` option to get any server build.
- `02-CONVENTIONS.md` §"Health scheduler boot" — scheduler must start ONCE at boot via a server-boot hook, not per-request.
- `packages/dashboard/src/hooks.server.ts` (legacy) lines 45–52 — reference for the "run once at boot" `init` pattern being replaced.
- Legacy deploy contract: `packages/dashboard/AGENTS.md` §Deploy (port 3080, `HOST=127.0.0.1`, `EnvironmentFile=/opt/cortexos/.secrets/dashboard.env`, runs as root for PAM).

## Steps
1. In `vite.config.ts`, add an explicit `nitro` option to the `defineConfig` call so the build targets Node and emits to a stable dir:
   ```ts
   import { defineConfig } from "@lovable.dev/vite-tanstack-config";
   export default defineConfig({
     nitro: { preset: "node-server" },
     tanstackStart: { server: { entry: "server" } },
   });
   ```
   Keep the existing `tanstackStart.server.entry: "server"` line (redirects to `src/server.ts`). Do NOT add `tanstackStart`, `viteReact`, `nitro` as separate plugins — the lovable wrapper injects them; duplicating breaks the build.
2. Run a build and locate the emitted Node entry. With `node-server`, Nitro writes a standard `.output/server/index.mjs` (run with `node .output/server/index.mjs`). Confirm the exact path from the build log (the current Cloudflare/sandbox path is `dist/server/server.js`; the node-server preset produces `.output/`). Record the verified path in `DEPLOY.md`.
3. Create `src/server/runtime.ts` exporting an idempotent `bootRuntime()` that is the single place server-boot side-effects are registered. For Wave 0 it must be a safe no-op stub with a guard flag and a clear extension comment, e.g.:
   ```ts
   let booted = false;
   /** Run-once server boot hook. WP-10 wires the health scheduler here. */
   export function bootRuntime(): void {
     if (booted) return;
     booted = true;
     // WP-10: import { startHealthScheduler } from "./health/scheduler"; startHealthScheduler();
   }
   ```
   Do NOT import the scheduler now (it does not exist until WP-10) — leaving the import out keeps the build green.
4. Invoke `bootRuntime()` exactly once at server start. The clean seam is `src/start.ts` (the `createStart` instance runs at server init). Add a top-level `bootRuntime()` call there (module-eval-once), or register it via a TanStack Start server hook if `createStart` exposes one — verify against the installed `@tanstack/react-start` version before choosing. Keep `src/server.ts`'s error-wrapping body unchanged.
5. Write `docs/rebuild/DEPLOY.md`: build command (`pnpm --filter @cortexos/dashboard-next build`), the verified Node entry path, the run command with env (`HOST=127.0.0.1 PORT=3080 node <entry>`), and a note that the eventual systemd unit (WP-52) points `ExecStart` at this entry with `EnvironmentFile=/opt/cortexos/.secrets/dashboard.env`, running as root for PAM.

## Acceptance criteria
- [ ] `pnpm --filter @cortexos/dashboard-next build` succeeds and emits a Node server entry (Nitro `node-server`), NOT a Cloudflare worker bundle.
- [ ] `node <entry>` starts and serves the stock sys-pilot app (HTTP 200 on `/` or `/login`) on a configurable port.
- [ ] `src/server/runtime.ts` exports an idempotent `bootRuntime()` and is invoked exactly once at boot; build stays green with no scheduler import.
- [ ] `docs/rebuild/DEPLOY.md` documents the exact build + run commands and the verified entry path.
- [ ] no edits outside OWNS.

## Verification commands
```bash
pnpm --filter @cortexos/dashboard-next build
# Confirm node-server output exists (path from build log; expected):
ls -la packages/dashboard-next/.output/server/index.mjs
# Smoke-run on a test port and curl it:
( cd packages/dashboard-next && PORT=3099 HOST=127.0.0.1 node .output/server/index.mjs & )
sleep 2 && curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3099/login   # expect 200
```

## Notes / gotchas
- The lovable wrapper SKIPS Nitro entirely when `nitro` is `undefined` outside a sandbox — an explicit `nitro: {...}` is mandatory, otherwise `vite build` produces only the client bundle and no server.
- `nitro@3.0.260429-beta` predates the `defaultPreset` auto-detect (3.0.260603-beta); always set an explicit `preset`. Do not rely on zero-config detection.
- Verify the actual output path from the build log — preset output dirs differ (`.output/` for `node-server` vs the sandbox `dist/`). Do not hardcode a guess into DEPLOY.md.
- Production runs as root (PAM in-process) on loopback `127.0.0.1:3080`, reverse-proxied by Caddy. Do not bind `0.0.0.0`.
- Do not start the scheduler in this WP; WP-10 owns `src/server/health/**` and wires it into `bootRuntime()`.
