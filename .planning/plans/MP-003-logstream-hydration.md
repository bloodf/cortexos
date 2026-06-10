# MP-003 — fix LogStream SSR/client hydration mismatch (React #418 on /healthcheck)

## Requirements
- MP3-R1: defect D-002 in `.planning/harness/artifacts/screen-defects-3.md` —
  `/healthcheck` throws `[pageerror] Minified React error #418` (hydration
  text mismatch). Root cause per gated analysis AN-002
  (`.planning/harness/artifacts/AN-002-healthcheck-hydration.md`):
  `packages/dashboard-next/src/components/LogStream.tsx:24-33` — `makeLine()`
  uses `new Date()` + `Math.random()` and runs inside the `useState`
  initializer (`:30`), so SSR and the client hydration render produce
  different text for 40 log lines.
- MP3-R2 (AN-002 "must NOT change"): keep `LogStream`'s public API
  (`height`, `intervalMs`, `max`) and post-mount visual behavior; no changes
  to data fetching, route loaders, or other components.

All paths relative to `packages/dashboard-next/`.

## File ownership (exclusive — touch nothing else)
- `src/components/LogStream.tsx`
- `src/components/__tests__/logstream-hydration.test.tsx` (new test file;
  create the `__tests__` directory if absent)
- Report file (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-003-report.md`

## Tasks (TDD order)
1. RED: new test `logstream-hydration.test.tsx` asserting the initial render
  is deterministic: render `<LogStream />` twice to static markup
  (`renderToString` or the project's component-test pattern — check
  existing component tests under `src/components/` or `src/features/` for
  the established harness; vitest + jsdom are configured) and assert the
  two outputs are identical. With the current code the 40 random lines make
  them differ — the test MUST fail. Quote the failing output in the report.
2. GREEN: in `LogStream.tsx`, change the `useState` initializer to `[]` and
  populate the initial 40 lines inside the existing mount `useEffect`
  (per AN-002 "Recommended minimal fix": server and client both render the
  empty list; random lines appear only after mount). Keep the interval
  ticker behavior unchanged. Test now passes.
3. Gates from `/opt/cortexos`
  (`set -a; source /opt/cortexos/.secrets/dashboard.env; set +a`):
  - `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit`
  - `pnpm --filter @cortexos/dashboard-next exec vitest run`
    (full package suite — LogStream may be used by other routes)
  - `pnpm exec eslint packages/dashboard-next/src/components/LogStream.tsx`
    must report no NEW errors on changed lines vs the pre-edit file (the
    package has known pre-existing lint debt; only the touched lines count).
4. Commit (one commit):
  `fix(dashboard-next): defer LogStream line generation to post-mount — SSR hydration mismatch (MP-003)`

## Acceptance (binary)
- A1: report quotes the failing test output (RED) and its pass (GREEN).
- A2: `tsc --noEmit` exit 0; full `vitest run` exit 0, zero failures.
- A3: `git diff <pre-commit>..HEAD --stat` lists exactly the two owned files.
- A4 (orchestrator, after central rebuild + restart): screen verification
  shows `/healthcheck` PASS with zero console errors.

## Out of scope
- Replacing the mock log generator with real log streaming (separate
  operator decision — flagged in the session report; this plan only fixes
  the hydration defect).
- `Healthcheck.tsx`, `DataTable.tsx`, routes, loaders, any other component.
- Build, deploy, systemctl — orchestrator does these centrally.
