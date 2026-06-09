# WP-36 — UI: System / Network / Storage / Processes / Terminal
- **Wave:** 2   **Depends-on:** WP-04, WP-14 (final wiring), WP-19 (terminal final wiring)   **Parallel-safe-with:** WP-30–WP-35, WP-37–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.network.tsx`
  - `src/routes/_authenticated.storage.tsx`
  - `src/routes/_authenticated.processes.tsx`
  - `src/routes/_authenticated.terminal.tsx`
  - `src/features/Network.tsx`
  - `src/features/Storage.tsx`
  - `src/features/Processes.tsx`
  - `src/features/Terminal.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, overview widgets, any other route or feature file

## Objective

Wire four system-level pages to real data: Network (`GET /api/network` — physical NICs only), Storage (`GET /api/system` drives/mounts — physical disks only), Processes (`GET /api/processes`), and Terminal (replace the mock PTY with a real WebSocket PTY via `GET /api/terminal` WebSocket upgrade). The terminal is the most significant change: the existing xterm.js UI is kept 1-1 but the local `run()` mock command interpreter is replaced by a real PTY over WebSocket. Visual layout stays 1-1 for all four pages.

## Read first

- `src/features/Network.tsx` — calls `api.network`; renders interface cards + topology
- `src/features/Storage.tsx` — calls `api.system` (drives + mounts from system payload); DataTable server prop `api.drivesList`
- `src/features/Processes.tsx` — calls `api.processes`; list and tree views; `refetchInterval: 3000`
- `src/features/Terminal.tsx` — full mock PTY implementation: `TerminalTab` component with xterm.js, local `run()` command interpreter, tabs, broadcast bar
- `src/mocks/api.ts` — `api.network`, `api.system` (drives/mounts), `api.processes`, `api.drivesList`
- `01-API-CONTRACT.md`:
  - `GET /api/network → {interfaces:[]}` physical NICs only (`/sys/class/net/*/device`)
  - `GET /api/system → {uptime, load, memory, disk}` — also includes drives/mounts per legacy
  - `GET /api/processes → {processes:[]}`
  - `GET /api/terminal` (WebSocket upgrade, admin only) → PTY stream (allowlisted shell)
- `src/lib/api/` (WP-04) — typed client; check if WP-04 exposes a `connectTerminal(): WebSocket` helper
- `src/lib/adapters/` (WP-04) — system/network/process adapters
- Legacy reference: `packages/dashboard/src/routes/(authed)/network/+page.server.ts`, `packages/dashboard/src/routes/(authed)/storage/+page.server.ts`, `packages/dashboard/src/routes/(authed)/processes/+page.server.ts`, `packages/dashboard/src/routes/(authed)/terminal/+page.server.ts`
- Legacy terminal: `packages/dashboard/src/routes/(authed)/terminal/+page.svelte` — shows how the PTY WS was used

## Steps

### Network

1. Replace `queryFn: api.network` with `queryFn: () => apiClient.network()`.
   - Response shape: `{interfaces: NetworkInterface[]}`. Adapt to the component shape (fields: `name`, `rxKbps`, `txKbps`, `rxBytesTotal`, `txBytesTotal`).
   - `refetchInterval: 3000` — keep as-is.
   - Physical-NIC filtering is done server-side (WP-14); the frontend renders whatever the API returns.
   - `<NetworkTopology>` component: if it calls `api.network` internally, update that call too.

### Storage

2. Replace `queryFn: api.system` (for drives/mounts) with `queryFn: () => apiClient.system()`.
   - The `GET /api/system` response in the contract shows `{uptime, load, memory, disk}`. The legacy response also carries `drives` and `mounts` arrays. Confirm with WP-14 output whether drives/mounts are in the system payload or a separate `GET /api/storage` endpoint. Use whichever WP-14 implements.
   - Replace `api.drivesList` (DataTable server prop) with a client function wrapping the drives array into `ListResult<DriveInfo>` format (client-side pagination is fine — drive counts are small).
   - Physical-disk filtering is server-side (exclude tmpfs/overlay/loop).

### Processes

3. Replace `queryFn: api.processes` with `queryFn: () => apiClient.processes()`.
   - Response: `{processes: ProcessInfo[]}`. Extract `data.processes`.
   - Adapt `ProcessInfo` fields (`pid`, `user`, `command`, `cpu`, `mem`) from contracts shape.
   - `refetchInterval: 3000` — keep.
   - Tree view (`TreeView` component) continues to work on the client-side grouped structure — no change needed there.

### Terminal — real PTY

4. **Replace the mock PTY with a real WebSocket PTY.**
   - This is the most significant change in WP-36. Keep the entire xterm.js tab UI (`TerminalTab`, `TerminalPage` chrome: tab strip, add-tab, close-tab, broadcast bar, send-keys input) exactly 1-1. Only replace the data plumbing inside `TerminalTab`.
   - Remove the local `run()` function and `BANNER`/`HELP`/`PROMPT` mocks entirely.
   - In `TerminalTab`, after xterm is mounted:
     a. Open a WebSocket to `ws://[host]/api/terminal` (or `wss://` in production). The server performs the upgrade when `GET /api/terminal` receives an `Upgrade: websocket` request. Include the session cookie (sent automatically by the browser on same-origin WS).
     b. The WS carries raw PTY bytes. Wire xterm's `onData` → `ws.send(data)` and `ws.onmessage` → `term.write(event.data)` (or `term.write(new Uint8Array(event.data))` if binary).
     c. On WS open, `fit.fit()` and send an initial resize message if WP-19 defines one (check WP-19 protocol — legacy used `{"type":"resize","cols":N,"rows":N}`).
     d. On WS close or error, write `\r\n[session closed]\r\n` to xterm and disable input.
     e. On component unmount (existing `return () => { ... }` cleanup), call `ws.close()` before `term.dispose()`.
   - **Broadcast** (`sendCommand` in `TerminalPage`): instead of calling `handle.execute(text)` (which fed the mock interpreter), call `ws.send(text + "\r")` on each tab's WebSocket. The `TabHandle.execute` method should be updated to send to the real WS.
   - **Admin gate**: the existing `if (!user?.is_admin)` guard renders `<EmptyState icon={<Lock>}` — keep this exactly as-is. The WS endpoint also enforces admin server-side.
   - **Multiple tabs**: each `TerminalTab` instance opens its own independent WebSocket connection to `/api/terminal`.

5. **Loading / empty states for system pages.**
   - Network: if `interfaces` is empty, `<EmptyState>` "No physical network interfaces found."
   - Storage: if drives is empty, DataTable empty state. If mounts is empty, no mountpoint cards rendered (already handles gracefully via `.map()`).
   - Processes: if process list is empty, existing DataTable `<EmptyState>`.

## Acceptance criteria

- [ ] Network page shows real physical NICs only (no loopback/virtual unless present on real NIC)
- [ ] Storage page shows real physical disks and mounts (no tmpfs/overlay/loop entries)
- [ ] Processes page shows real processes with CPU/MEM; refreshes every 3 s
- [ ] Terminal: xterm tabs connect to real PTY via WebSocket; `ls`, `pwd`, real shell commands work
- [ ] Terminal: multi-tab, close-tab, broadcast send-keys all work with real PTY
- [ ] Terminal: non-admin user sees the 403 EmptyState (admin gate preserved)
- [ ] No mock `run()` interpreter, `BANNER`, `HELP` constants remain in production code
- [ ] Visual appearance unchanged vs sys-pilot for all four pages
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
curl http://localhost:3080/api/network -b <session>
curl http://localhost:3080/api/processes -b <session>
curl http://localhost:3080/api/system -b <session>
# Terminal: open /terminal in browser as admin, type `whoami` — should return real user
# Terminal: open /terminal in browser as non-admin — should see 403 empty state
```

## Notes / gotchas

- **Real PTY terminal**: the `run()` mock and `BANNER`/`HELP`/`PROMPT`/`SAMPLE_LOGS` constants at the top of `Terminal.tsx` are all fabricated data — remove them entirely. The real PTY provides its own shell banner/prompt.
- **WebSocket URL**: use `const proto = location.protocol === "https:" ? "wss:" : "ws:"` to build the WS URL, ensuring it works in both dev and production.
- **Resize events**: xterm's `FitAddon` already hooks `ResizeObserver` — also send a resize message to the PTY WS when the fit fires, so the remote PTY cols/rows stay in sync. Check WP-19 for the resize message format.
- **Binary vs text**: node-pty emits raw bytes. Prefer `ws.binaryType = "arraybuffer"` and `term.write(new Uint8Array(event.data))`.
- **`GET /api/storage`**: the contract lists this "or via /system". Confirm with WP-14 which path is implemented. If `/api/storage` exists separately, use it; otherwise drive data comes from `/api/system`.
- **Physical NIC filter and physical disk filter** are enforced server-side by WP-14; the frontend simply renders what it receives.
- The `NetworkTopology` component in `src/components/NetworkTopology.tsx` may call `api.network` directly — check and update if so.
