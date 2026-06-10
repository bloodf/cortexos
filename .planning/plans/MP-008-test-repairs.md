# MP-008 — repair the 11 broken jsdom tests + pin NODE_ENV for vitest

## Requirements (root-cause analysis: `.planning/analysis/AN-003-broken-tests.md`, gate-hardened, dispositions in GATE-RESOLUTION.md)
- MP8-R1: 7 DataTable tests fail with `No QueryClient set`
  (`.planning/harness/artifacts/recon-test-failures.md:12-19`) —
  `DataTable.tsx:87` calls `useQuery` unconditionally and the tests render
  without a provider. Fix: render via the existing `renderWithProviders`
  helper (`src/test/utils.tsx`).
- MP8-R2: 4 useAuth tests fail with `No Start context found in
  AsyncLocalStorage` (`recon-test-failures.md:20-27`) — the hook calls real
  server fns from jsdom (`useAuth.tsx:67`), the pattern
  `packages/dashboard-next/CLAUDE.md:157-158` rules out ("bare `await
  fn()` in vitest will NOT invoke the extracted handler; use the node-env
  test harness"; same rule at `packages/dashboard-next/AGENTS.md:121`).
  Fix: `vi.mock("@/lib/api/auth.functions")` mocking the module's REAL
  exports — `login`, `logout`, `me` (`useAuth.tsx:3`:
  `import { login as loginFn, logout as logoutFn, me as meFn } from
  "@/lib/api/auth.functions"` — the `callLogin`/`callLogout`/`callMe`
  names are hook-local aliases and must NOT be the mock keys). Package
  precedent: `src/server/db/__tests__/client.test.ts:14` mocks `pg`.
  Constraints:
  - "switchUser toggles admin" asserts REMOVED functionality —
    `useAuth.tsx:83` is a documented no-op (deprecated at :13-14). REWRITE
    it as "switchUser is a no-op (role comes from PAM groups)": call it,
    assert `user` is unchanged.
  - "rejects empty credentials" (`useAuth.test.tsx:29`) currently passes
    only because ANY throw satisfies it. The mocked login MUST implement
    the empty-credentials rejection (mirroring the real gate's zod
    non-empty constraint) so the assertion tests real behavior.
- MP8-R3: `/opt/cortexos/.secrets/dashboard.env:2` sets
  `NODE_ENV="production"`; sourcing it before vitest loads
  `react-dom-test-utils.production.js` (no `act` export —
  `.planning/harness/artifacts/impl-mp-003-report.md:170`), failing ~50
  jsdom tests (`:162` vs `:378`). Fix per AN-003 §3: add
  `env: { NODE_ENV: "test" }` to the `test` block of
  `packages/dashboard-next/vitest.config.ts` (vitest applies `test.env` to
  `process.env`; mechanism quoted in AN-003 §2a). The env FILE itself is
  untouched — it is correct for the live service.

ALL commands run from `/opt/cortexos`; paths repo-relative.

- MP8-R4 (amendment, post-MP-007; evidence in GATE-RESOLUTION.md "MP-008
  tsc amendment"): `tsc --noEmit` fails with 27× TS2339
  `toBeInTheDocument does not exist on type 'Assertion<...>'` across
  DataTable/DiffViewer tests. Cause: `@testing-library/jest-dom`'s
  `declare module 'vitest'` augmentation no longer resolves to
  dashboard-next's vitest instance — the legacy package pinned
  vitest@4.1.6 into the workspace (removed-lockfile lines show
  `@testing-library/svelte(...)(vitest@4.1.6)`), and after MP-007's
  reinstall dashboard-next resolves vitest@4.1.8 while the augmentation
  path does not. Fix: new file
  `packages/dashboard-next/src/test/jest-dom.d.ts` declaring the
  augmentation in-package (where `vitest` resolves to the package's own
  instance):
  `import type { TestingLibraryMatchers } from "@testing-library/jest-dom/types/matchers";`
  then `declare module "vitest" { interface Assertion<T = any> extends
  TestingLibraryMatchers<any, T> {} interface
  AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {} }`.
  No dependency changes; `@testing-library/jest-dom` is already a direct
  devDep (`package.json:86`).

## File ownership (exclusive — touch nothing else)
- `packages/dashboard-next/vitest.config.ts`
- `packages/dashboard-next/src/components/DataTable.test.tsx`
- `packages/dashboard-next/src/hooks/useAuth.test.tsx`
- `packages/dashboard-next/src/test/jest-dom.d.ts` (new, per MP8-R4)
- `packages/dashboard-next/src/test/setup.ts` (amendment, post-impl: the
  legacy package's deleted vitest.setup.ts carried an explicit
  `expect.extend(matchers)` workaround; MP-007's removal broke RUNTIME
  matcher registration alongside the MP8-R4 type break. setup.ts restores
  the explicit extend. Logged in GATE-RESOLUTION.)
- Report (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-008-report.md`

## Tasks (TDD order)
1. RED: `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; export NODE_ENV=test; cd packages/dashboard-next && pnpm exec vitest run src/components/DataTable.test.tsx src/hooks/useAuth.test.tsx'`
   → expect `11 failed | 2 passed (13)`; quote the summary. Also
   `grep -c 'env:' packages/dashboard-next/vitest.config.ts` → 0. And the
   MP8-R4 RED: `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit`
   currently exits non-zero with 27× TS2339 (quote the count).
1b. Create `src/test/jest-dom.d.ts` per MP8-R4; `tsc --noEmit` now exits 0
   (quote). This restores the pre-MP-007 type state before the test edits.
2. vitest.config.ts: add `env: { NODE_ENV: "test" }` inside the `test`
   block. No other config change.
3. DataTable.test.tsx: switch renders to `renderWithProviders`
   (`src/test/utils.tsx`). Keep every assertion's intent; no test deleted.
4. useAuth.test.tsx: add `vi.mock("@/lib/api/auth.functions", ...)` whose
   factory returns `{ login, logout, me }` (the real module exports per
   MP8-R2) as `vi.fn()`s returning fake ContractUser shapes; mocked
   `login` rejects when username or password is empty; rewrite the
   switchUser test per MP8-R2. REPAIR "starts logged out" (AN-003 §1 found
   it asserts synchronously before the mount `me()` probe resolves): with
   mocked `me` resolving to a null/no-user shape, await the probe's
   settlement (e.g. `waitFor` on the mocked `me` having been called and
   state settled) and THEN assert `user` is null — the test must verify
   the resolved logged-out state, not the pre-effect initial state.
   RACE GUARD (applies to EVERY test in the file): the mount effect runs
   `callMe` asynchronously (`useAuth.tsx:52`), so a late-resolving mocked
   `me` can overwrite state set by `login()`/`logout()`. Every test must
   first await the mount probe's settlement before invoking actions, so
   no assertion can be clobbered by the probe resolving mid-test. Keep
   "rejects empty credentials" passing against the mock's real rejection
   (with the real fn mocked away, the Start-context error can no longer
   satisfy the assertion — only the mock's rejection can).
5. GREEN + env proof: re-run the Task-1 command WITHOUT `export
   NODE_ENV=test` (env file still sourced) → zero failures in the two
   files; then full suite the same way:
   `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
   → zero failed tests, total ≥ 543. Quote both summaries.
6. `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` exit 0.
   Lint (same no-new-violations standard as the G3 amendment): BEFORE the
   edits record `pnpm exec eslint <the three owned files> 2>&1 | tail -1`
   (problem-count line + exit code); AFTER the edits the same command must
   show a problem count ≤ the BEFORE count and zero `no-undef` hits. Quote
   both outputs.
7. ONE commit:
   `fix(dashboard-next): repair jsdom tests — providers, auth-fn mocks, vitest NODE_ENV pin (MP-008)`

## Acceptance (binary)
- A1: Task-1 RED summary and both Task-5 GREEN summaries quoted; the full
  suite runs green WITHOUT any shell NODE_ENV override (proves the config
  pin).
- A2: diff touches exactly the three owned files.
- A3 (binary): the report quotes the rewritten switchUser test verbatim;
  `awk '/switchUser/,/^  \}\);/' packages/dashboard-next/src/hooks/useAuth.test.tsx | grep -c 'expect('`
  outputs ≥ 1 (the test block contains an assertion), and that assertion
  compares `result.current.user` before/after the `switchUser` call (visible
  in the quoted test). The mock factory contains an explicit
  empty-credentials rejection, checked INSIDE the factory block only:
  `awk '/vi\.mock\("@\/lib\/api\/auth\.functions"/,/^\}\)/' packages/dashboard-next/src/hooks/useAuth.test.tsx | grep -cE 'reject|throw'`
  outputs ≥ 1. Behavioral backstop: with the module mocked, the real fn is
  never invoked, so "rejects empty credentials" passing in the GREEN run
  can only be satisfied by the mock's rejection.
- A4: test count does not decrease (≥ 13 in the two files; ≥ 543 total).
- A5: the repaired "starts logged out" test awaits the mocked `me` probe
  before asserting (visible in the quoted diff: a `waitFor`/await of the
  probe precedes the null assertion), and passes in the GREEN run; the
  quoted diff shows every test awaiting probe settlement before actions
  (Task-4 race guard).
- A6: Task-6 outputs quoted — `tsc --noEmit` exit 0; the AFTER lint
  problem count ≤ BEFORE on the three owned files with zero `no-undef`.

## Out of scope
- `useAuth.tsx`, `DataTable.tsx`, any non-test source.
- `/opt/cortexos/.secrets/dashboard.env` and systemd units.
- Removing the deprecated `switchUser` API itself (separate decision).
