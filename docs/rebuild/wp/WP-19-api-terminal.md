# WP-19 — API: Terminal (WebSocket PTY)

- **Wave:** 1
- **Depends-on:** WP-01
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-14, WP-15, WP-16, WP-17, WP-18, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/terminal/`
  - `packages/dashboard-next/src/routes/api/terminal/`
- **Do NOT touch:** `src/server/policy/` (read-only), `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, any other WP's folder

## Objective

Port the terminal WebSocket PTY bridge from the legacy SvelteKit app to TanStack Start. This WP implements the real PTY (via `node-pty`) and the operation dispatch (allowlisted named ops). The legacy `pty-bridge.ts` ships a stub (`M2_STUB_MARKER`) for named ops and a real PTY for `term.exec_named`. Wave 1 ships the real PTY path — the stub marker is removed. Admin-only. All shell arguments validated against the policy allowlist; `validateShellArg()` blocks metacharacters.

## Read first

- **Legacy bridge (primary source — read fully):**
  - `packages/dashboard/src/lib/server/terminal/pty-bridge.ts` — full file:
    - `dispatch(op, args, ctx)` — routes named ops to their executor
    - `listTerminalOps()` — returns policy `terminal.*` entries
    - `M2_STUB_MARKER = 'M2_PTY_STUB'` — present in legacy M2; **remove in this WP**
    - Named ops: `term.ps`, `term.df`, `term.ls`, `term.cat`, `term.tail_log`, `term.exec_named`
    - Real PTY spawn: `node-pty` `IPty`, `spawn()`, resize messages, data/exit events
    - `validateAllArgs(args)` — calls `validateShellArg` per arg; throws if any fails
    - `M3_REAL_PTY` flag or platform check to switch between stub and real
- **Legacy API handler:**
  - `packages/dashboard/src/routes/api/terminal/+server.ts` — POST (named op dispatch) + GET (list ops)
- **Policy allowlist:**
  - `packages/dashboard/src/lib/server/policy/index.ts` — `terminal.*` entries:
    - `term.exec_named`, `term.read_file`, `term.tail_log`, `term.ps`, `term.top`, `term.df`, `term.fzf`
    - Each has `argv` template with `{{ arg }}` slots; `requiresApproval: false` for reads
  - `validateShellArg(arg)` — blocks shell metacharacters: `; & | $ \` ( ) { } < > ! # * ? [ ] ~ ^ `
- **Contract section:** `01-API-CONTRACT.md §Terminal (WP-19)`
- **WebSocket contract:** `GET /api/terminal` upgrades to WebSocket; messages: `{type:'input',data:string}`, `{type:'resize',cols,rows}` client→server; `{type:'output',data:string}`, `{type:'exit',code:number}` server→client

## Steps

1. **Port `src/server/terminal/pty-bridge.ts`** — copy from legacy `pty-bridge.ts`. Update imports:
   - `node-pty` stays
   - `'../policy'` → relative path to `src/server/policy/`
   - Remove `M2_STUB_MARKER` and all stub paths
   - For `term.exec_named` and all named ops: use the real executor paths (the `else` branch where real execution occurs)

   Key constants to preserve:
   ```ts
   const EXEC_TIMEOUT_MS = 30_000;
   const READ_TIMEOUT_MS = 10_000;
   const MAX_BUFFER = 4 * 1024 * 1024;
   ```

   Preserve exports: `dispatch`, `listTerminalOps`, `validateAllArgs`, `spawnPty`.

2. **Named op dispatch** — `dispatch(op: string, args: string[], ctx)`:
   - Call `allowlistedCommand('terminal.' + op)` — throws if not in policy
   - Call `validateAllArgs(args)` — throws `validationError` if any arg fails shell-safety check
   - Render argv from the policy template, substituting `{{ arg }}` slots with the validated args
   - `execFile(cmd, argv, { timeout: ..., maxBuffer: MAX_BUFFER })` — no shell
   - Return `{ stdout, stderr, exitCode }`

3. **Real PTY spawn** — `spawnPty(ctx)`:
   ```ts
   import * as pty from 'node-pty';
   
   export function spawnPty(shell: string, cols: number, rows: number): pty.IPty {
     const ALLOWED_SHELLS = ['/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/zsh'];
     if (!ALLOWED_SHELLS.includes(shell)) throw new Error(`shell_not_allowed: ${shell}`);
     return pty.spawn(shell, [], {
       name: 'xterm-256color',
       cols,
       rows,
       cwd: '/home/cortexos',
       env: {
         ...process.env,
         TERM: 'xterm-256color',
         COLORTERM: 'truecolor',
       },
     });
   }
   ```
   Shell is allowlisted to prevent arbitrary binary execution. Default shell: `/bin/bash`.

4. **Declare named op route — `src/routes/api/terminal/index.ts`:**
   ```
   GET  /api/terminal — auth: admin
        returns {ops: TerminalOp[]}
        → listTerminalOps()

   POST /api/terminal — auth: admin
        rateLimit: { limit: 10, windowSec: 60, bucket: 'user' }
        input: { op: string, args: string[] }
        → validateAllArgs(args), dispatch(op, args, ctx)
        returns { stdout: string, stderr: string, exitCode: number }
   ```
   Input schema:
   ```ts
   z.object({
     op: z.string().min(1).max(64),
     args: z.array(z.string().max(2048)).max(16),
   })
   ```
   Translate dispatch errors:
   - `not_allowlisted` → `permissionError`
   - `shell_arg_invalid` → `validationError`
   - `executor_error` with exit code → return `{stdout, stderr, exitCode}` (not an HTTP error; let client handle non-zero exit)

5. **Declare WebSocket PTY route — `src/routes/api/terminal/pty/index.ts`:**

   TanStack Start does not have native WebSocket route support in the same way as SvelteKit. Use the Vinxi/h3 WebSocket upgrade hook:
   ```ts
   import { defineEventHandler, getRequestHeader, upgradeWebSocket } from 'h3';
   
   export const GET = defineEventHandler(event => {
     // Verify session + admin RBAC before upgrade
     const session = await resolveSession(event);
     if (!session || !isAdmin(session)) return sendError(event, 403);
   
     return upgradeWebSocket(event, {
       onOpen(ws) {
         const term = spawnPty('/bin/bash', 80, 24);
         term.onData(data => ws.send(JSON.stringify({ type: 'output', data })));
         term.onExit(({ exitCode }) => ws.send(JSON.stringify({ type: 'exit', code: exitCode })));
         (ws as any)._pty = term;
       },
       onMessage(ws, msg) {
         const parsed = JSON.parse(typeof msg.data === 'string' ? msg.data : msg.data.toString());
         const term = (ws as any)._pty as pty.IPty;
         if (parsed.type === 'input') term.write(parsed.data);
         else if (parsed.type === 'resize') term.resize(parsed.cols, parsed.rows);
       },
       onClose(ws) {
         const term = (ws as any)._pty as pty.IPty | undefined;
         if (term) try { term.kill(); } catch {}
       },
     });
   });
   ```
   Check the TanStack Start / Vinxi docs for the exact `upgradeWebSocket` API — the above is the h3 pattern. If TanStack Start exposes a different WebSocket hook, use that instead. The session check **must** happen before the upgrade; do not upgrade unauthenticated requests.

6. **Auth / audit:**
   - Named ops POST: `auth: 'admin'`, `surface: 'terminal'`, `action: 'terminal.dispatch'`
   - Named ops GET: `auth: 'admin'`, `surface: 'terminal'`, `action: 'terminal.list-ops'`
   - WebSocket route: manual session check (pre-upgrade); audit the connection open event via `appendAuditLog` with `surface: 'terminal'`, `action: 'terminal.pty-connect'`

## Acceptance criteria

- [ ] `GET /api/terminal` returns `{ops: [...]}` with at least `term.ps`, `term.df`, `term.ls`, `term.tail_log`
- [ ] `POST /api/terminal` with `{op:'term.ps', args:[]}` returns stdout with process list; `exitCode: 0`
- [ ] `POST /api/terminal` with `{op:'term.ps', args:['--format=pid,cmd; rm -rf /']}` → 400 (shell metacharacter in arg)
- [ ] `POST /api/terminal` with `{op:'term.nonexistent', args:[]}` → 403 (`not_allowlisted`)
- [ ] `GET /api/terminal` (non-admin) → 403
- [ ] WebSocket `GET /api/terminal/pty` (unauthenticated) → 403 before upgrade
- [ ] WebSocket `GET /api/terminal/pty` (admin) → upgrade succeeds; `{type:'output'}` messages arrive; `{type:'resize', cols:120, rows:40}` resizes PTY; close message terminates PTY process
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No stub marker (`M2_PTY_STUB`) left in bridge — real execution paths only
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# List ops
curl -s http://localhost:3080/api/terminal \
  -b "cortexos_session=$SESSION" | jq '[.ops[].name]'

# Named op: ps
curl -s -X POST http://localhost:3080/api/terminal \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"op":"term.ps","args":[]}' | jq '{exitCode, lines:(.stdout | split("\n") | length)}'

# Shell injection blocked
curl -s -X POST http://localhost:3080/api/terminal \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"op":"term.ps","args":["aux; echo INJECTED"]}' | jq .code
# expect validation_error

# WebSocket PTY (requires wscat or websocat)
# websocat -v "ws://localhost:3080/api/terminal/pty" \
#   --header "Cookie: cortexos_session=$SESSION" &
# Send: {"type":"input","data":"id\n"}
# Expect: {"type":"output","data":"uid=..."}

# Confirm no stub marker
grep -r 'M2_PTY_STUB\|M2_STUB_MARKER' packages/dashboard-next/src/server/terminal/ && echo FOUND || echo CLEAN
```

## Notes / gotchas

- **`node-pty` native addon** — `node-pty` must be listed in `packages/dashboard-next/package.json` dependencies. It builds a native `.node` file. Ensure the monorepo's pnpm workspace config includes it and that `node-gyp` / `python` are available in the build environment. Check the legacy `packages/dashboard/package.json` for the exact pinned version.
- **`validateShellArg` is security-critical** — the check blocks shell metacharacters before argv construction. Port it verbatim from the policy module. Do not relax the character set. The legacy function throws with code `shell_arg_invalid` if any forbidden character is found.
- **Policy template rendering** — each policy entry has an `argv` array with `{{ arg }}` slots. Render by replacing slots with the validated args in order. If the arg count doesn't match the slot count, throw `validationError`. Do not use string interpolation or template literals — use the policy's slot-filling mechanism.
- **PTY shell allowlist** — `spawnPty` only accepts a fixed list of known shell paths. Never `spawn(userInput)` directly. Default to `/bin/bash`; the client may request a different shell only if it's in the allowlist.
- **WebSocket auth before upgrade** — TanStack Start / h3 allows reading cookies/headers before calling `upgradeWebSocket`. The session must be validated and the admin check must pass **before** the upgrade call. If the upgrade is called with an unauthenticated request, the WebSocket opens on an unauthenticated connection.
- **PTY leak prevention** — `onClose` must call `term.kill()` (SIGKILL). Leaked PTY processes accumulate as zombie processes. Use try/catch around `term.kill()` since the process may have already exited.
- **`execFile` for named ops** — named ops (term.ps, term.df, etc.) use `execFile`, not PTY. The PTY route (`/api/terminal/pty`) is for the interactive shell. The POST route (`/api/terminal`) is for one-shot named ops. They are distinct surfaces.
- **No DB dependency** — this WP needs only WP-01 (and the policy module ported in Wave 0). No DB queries.
- **`CORTEX_TERMINAL_SHELL` env var** — check the legacy bridge; it may honour an environment variable to override the default shell. If so, port that logic but still enforce the allowlist.
