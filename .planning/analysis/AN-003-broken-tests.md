# AN-003 Broken Tests Analysis

## 1. Per-test intent and escape line

### `src/components/DataTable.test.tsx` — 7 failures

All 7 tests fail with `Error: No QueryClient set, use QueryClientProvider to set one`.  
**Escape line:** `src/components/DataTable.tsx:87` (`useQuery({...})`).

This is **not** a `createServerFn` escape — it is a missing TanStack Query provider in the jsdom tree.  `DataTable` unconditionally calls `useQuery` (with `enabled: !!server`) even in local-mode tests where no `server` prop is passed; TanStack Query v5 still requires a `QueryClientProvider` ancestor.

| Test | Intent | Failing `render()` line |
|------|--------|------------------------|
| renders rows | Verify local rows render | `src/components/DataTable.test.tsx:17` |
| filters with filterFn | Verify client-side filtering | `src/components/DataTable.test.tsx:23` |
| toggles sort direction on header click | Verify local sort toggle | `src/components/DataTable.test.tsx:31` |
| renders skeleton when loading | Verify loading skeleton UI | `src/components/DataTable.test.tsx:38` |
| shows empty state | Verify empty-message render | `src/components/DataTable.test.tsx:43` |
| fires onRowContextMenu on right-click | Verify context-menu callback | `src/components/DataTable.test.tsx:49` |
| renders selection toolbar when rows selected | Verify selection toolbar | `src/components/DataTable.test.tsx:56` |

### `src/hooks/useAuth.test.tsx` — 4 hard failures + 2 false positives

The 4 async `login` calls fail with `Error: No Start context found in AsyncLocalStorage. Make sure you are using the function within the server runtime.`  
**Escape line:** `src/hooks/useAuth.tsx:67` (`await callLogin({ data: { username, password } })`), which invokes `loginFn` imported from `@/lib/api/auth.functions` — a `createServerFn` RPC.

| Test | Intent | Failing call line |
|------|--------|-------------------|
| logs in admin user | Verify `user` state becomes admin after login | `src/hooks/useAuth.test.tsx:17` |
| logs in standard user | Verify `user` state becomes non-admin after login | `src/hooks/useAuth.test.tsx:25` |
| logout clears user | Verify `logout()` resets `user` to null | `src/hooks/useAuth.test.tsx:36` (login path) |
| switchUser toggles admin | Verify `switchUser(false)` drops admin flag | `src/hooks/useAuth.test.tsx:43` (login path) |

**False positives (appear to pass only because the assertion is too loose or synchronous):**

- **starts logged out** (test at `src/hooks/useAuth.test.tsx:8`, assertion on the following lines) — asserts `user` is `null` synchronously, before the mount `useEffect` at `useAuth.tsx:52` (`callMe`) has a chance to throw. It does not actually verify that the session probe resolves to null.
- **rejects empty credentials** (`src/hooks/useAuth.test.tsx:31`) — `rejects.toThrow()` passes because the Start-context error is thrown, not because the server gate rejected empty credentials. This test would pass even if server-side validation were removed.

## 2. Recommended fix per repo conventions

### DataTable tests — wrap with `QueryClientProvider`

**Candidate:** (a) is irrelevant (no API boundary to mock). The correct fix is to use the existing `renderWithProviders` helper from `src/test/utils.tsx`, which wraps the tree in `QueryClientProvider` with retry/refetch disabled.  
**Reasoning:** Other component tests in the package already use this helper (e.g. `src/components/skeletons/skeletons.test.tsx:28` calls `renderWithProviders`).  Adding the wrapper is a one-line change per test and keeps the tests as genuine jsdom UI specs.

### useAuth tests — mock the auth.functions module

**Candidate:** (a) `vi.mock('@/lib/api/auth.functions')` — for three of the
four tests. The fourth, "switchUser toggles admin", asserts REMOVED
functionality and cannot be fixed by mocking:
`src/hooks/useAuth.tsx:83` — `const switchUser = useCallback((_admin:
boolean) => { /* no-op: role comes from PAM groups */ }, [])`, deprecated at
`:13-14`. That test must be REWRITTEN to assert the no-op contract (calling
`switchUser` leaves `user` unchanged) — which both documents the PAM-derived
role design and keeps the deprecated API pinned until removal.

**Reasoning:**
- `useAuth` is a React hook; its value is testing the React state machine (set user on login, clear on logout, hydrate from `me`), not the PAM/session pipeline.
- The **real** gate + handler behavior is already exhaustively covered by the node-env pipeline test `src/lib/api/__tests__/auth.functions.test.ts` (`loginGateOptions`, `logoutGateOptions`, `meGateOptions` driven through `defineApiRoute`).  That file validates PAM → group derive → cookie set/clear → audit, which the jsdom hook tests should never attempt to reproduce.
- `vi.mock` is already used in the package: `src/server/db/__tests__/client.test.ts:14` mocks `pg` with `vi.mock('pg', () => ({...}))`.

A minimal mock would return resolved fake `ContractUser` objects so the hook’s `toAuthUser` mapping and `setUser` transitions are exercised.

### What NOT to do

- **(b) rewrite as node-env pipeline tests** — impossible for a React hook test without a DOM renderer; the node env cannot mount React components.
- **(c) delete the tests** — the pipeline tests do **not** cover React hook state transitions. Deletion would lose coverage of `useAuth`’s `useState`/`useEffect`/`useCallback` logic.

## 2b. Reproducible failure evidence (orchestrator-captured)
Actual run output (NODE_ENV=test) lives at
`.planning/harness/artifacts/recon-test-failures.md`: all 7 DataTable
failures are `Error: No QueryClient set, use QueryClientProvider to set one`
(:19) and all 4 useAuth failures are `Error: No Start context found in
AsyncLocalStorage` (:21-27); summary `Tests 11 failed | 2 passed (13)` (:29).
The earlier "~50 failures across the package" figure under
NODE_ENV=production is recorded in the MP-003 gate-amendment entry of
`.planning/GATE-RESOLUTION.md`.

## 3. NODE_ENV fix

**Problem:** `/opt/cortexos/.secrets/dashboard.env` sets `NODE_ENV=production`. When that file is sourced before `vitest`, `@testing-library/react` loads `react-dom/cjs/react-dom-test-utils.production.js`, which does not export `act` (React 19 compat gap). This breaks **all** jsdom tests (~50 failures across the package).

**Current config** (`packages/dashboard-next/vitest.config.ts:7–12`):

```ts
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
```

**Minimal change:** add `env: { NODE_ENV: "test" }` inside the `test` block so vitest overrides the shell environment regardless of how `.secrets/dashboard.env` is sourced:

```ts
  test: {
    environment: "jsdom",
    env: { NODE_ENV: "test" },
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
```

This forces React into development mode where `act` is available, while leaving `.secrets/dashboard.env` unchanged for production runtime.

## 4. Constraints — what fixes must NOT change

1. **`.secrets/dashboard.env` semantics** — the production env file must stay intact; it is loaded by `cortex-dashboard.service` at runtime.
2. **Server-fn pipeline** — no changes to `src/lib/api/auth.functions.ts`, `src/lib/api/define-server-fn.ts`, or the pipeline core. The RPC transport is the canonical architecture per ADR-001.
3. **Existing passing tests** — the fix must not break the 493 tests that currently pass under `NODE_ENV=test` (including the node-env pipeline tests in `src/lib/api/__tests__/` and the db client tests in `src/server/db/__tests__/`).

ANALYSIS-COMPLETE
