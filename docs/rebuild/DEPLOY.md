# dashboard-next — build & run (Node server)

> Produced by WP-00. The new app builds to a standalone Node server via the Nitro
> **node-server** preset (set in `packages/dashboard-next/vite.config.ts`).

## Build
```bash
pnpm --filter @cortexos/dashboard-next build
```
Emits the Node server at:
```
packages/dashboard-next/.output/server/index.mjs        # verified entry
packages/dashboard-next/.output/public/                 # static client assets
```

## Run (local / manual)
```bash
cd /opt/cortexos/packages/dashboard-next
HOST=127.0.0.1 PORT=3080 node .output/server/index.mjs
# smoke: curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/login   # 200
# `/` 307-redirects to /login.
```
Bind **loopback only** (`127.0.0.1`); Caddy/Tailscale front it. Do not bind `0.0.0.0`.

## Production (set at cutover — WP-52)
`cortex-dashboard.service` (systemd), running as **root** (PAM in-process):
```ini
WorkingDirectory=/opt/cortexos/packages/dashboard-next
EnvironmentFile=/opt/cortexos/.secrets/dashboard.env
Environment=HOST=127.0.0.1 PORT=3080 NODE_ENV=production
ExecStart=/usr/bin/node .output/server/index.mjs
```
Rollback = repoint `ExecStart` at the legacy build (`packages/dashboard/build/index.js`).

## Gotchas (verified during WP-00)
- An explicit `nitro: { preset: "node-server" }` is **mandatory** — the @lovable wrapper
  skips Nitro (no server build) when `nitro` is undefined outside a sandbox.
- `react` and `react-dom` MUST be the **exact same version** (pinned to `19.2.7` in
  `package.json`) — SSR throws `Incompatible React versions` otherwise. pnpm resolved a
  mismatch (19.2.4 vs 19.2.7) under `^19.2.0` ranges.
- The server-boot hook lives in `src/server/runtime.ts` (`bootRuntime()`), invoked once from
  the server-only entry `src/server.ts`. It cannot be imported from `src/start.ts`
  (client-reachable → blocked by tanstack-start import-protection). WP-10 wires the health
  scheduler into `bootRuntime()`.
