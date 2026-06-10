# MP-002 — thread middleware-deserialized data into the server-fn gate

## Requirements
- MP2-R1: every GET server-fn call carrying input returns 400
  `{"message":"Validation failed","code":"validation","details":[{"field":"_root","message":"Unrecognized key(s) in object: 'payload'"}]}`.
  Defects D-001..D-035 class (a) in
  `.planning/harness/artifacts/screen-defects-2.md` all share this body
  (21 identical occurrences). Root cause per gated analysis AN-001
  (`.planning/harness/artifacts/AN-001-payload-validation.md`):
  - `src/server/server-fn-pipeline.ts:358-363` — `readRequestInput` dumps
    raw query params for GET, returning `{ payload: "<serialized>" }`.
  - `src/server/server-fn-pipeline.ts:174-175` — that raw object hits
    `opts.input.safeParse`, and `.strict()` schemas (e.g.
    `src/lib/api/system.functions.ts:34`) reject the unknown `payload` key.
  - The framework already deserializes the payload and passes it to the
    `.server()` middleware as `data`
    (`@tanstack/start-server-core@1.169.14` `dist/esm/server-functions-handler.js:49-56`,
    quoted in AN-001 §4); the gate discards it by destructuring only `{ next }`
    (`src/lib/api/define-server-fn.ts:133`).
- MP2-R2: the fix must not alter the POST path semantics, CSRF enforcement,
  the typed error envelope, or direct-`Request` test usage (AN-001 §4
  "must NOT break").

All paths below are relative to `packages/dashboard-next/`.

## File ownership (exclusive — touch nothing else)
- `src/lib/api/define-server-fn.ts`
- `src/lib/api/server-fn-runner.server.ts`
- `src/server/server-fn-pipeline.ts`
- `src/lib/api/__tests__/mp-002-get-input.test.ts` (new test file)
- Report file: `/opt/cortexos/.planning/harness/artifacts/impl-mp-002-report.md`

## Tasks (TDD order)
1. RED: create `src/lib/api/__tests__/mp-002-get-input.test.ts` following the
   existing node-env harness patterns in that directory. Two tests:
   - T1 "GET input comes from middleware data": drive the pipeline with a
     GET `Request` whose URL carries `?payload=<anything>` AND a
     middleware-provided input object `{ q: 'x' }` against a
     `z.object({ q: z.string().optional() }).strict()` schema; assert the
     handler receives `{ q: 'x' }` and no validation error occurs.
   - T2 "fallback preserved": no middleware input supplied; a GET `Request`
     with plain query params (no `payload` key) still validates via
     `readRequestInput` as today.
   Run the suite; T1 MUST fail with the `Unrecognized key(s) in object:
   'payload'` validation error (or equivalent "input ignored" assertion
   failure). Quote the failing output in the report. T2 must already pass.
2. GREEN, three coordinated edits (AN-001 §4 Option B):
   - `src/lib/api/define-server-fn.ts:133` — destructure `{ data, next }`
     in the `.server()` middleware and pass `data` to the runner as
     `inputData`.
   - `src/lib/api/server-fn-runner.server.ts:23` — accept optional
     `inputData` on the runner options and forward it to the pipeline.
   - `src/server/server-fn-pipeline.ts:172-188` — use
     `const raw = opts.inputData !== undefined ? opts.inputData : await readRequestInput(request);`
     before `safeParse`. No other logic changes; `readRequestInput` itself
     stays untouched.
   T1 now passes; T2 still passes.
3. Full gates, from `/opt/cortexos` with
   `set -a; source /opt/cortexos/.secrets/dashboard.env; set +a`:
   - `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit`
   - `pnpm --filter @cortexos/dashboard-next exec vitest run src/server src/lib/api`
   All green; quote summary counts in the report.
4. Commit (one commit):
   `fix(dashboard-next): validate server-fn input from middleware data, not raw query (MP-002)`

## Acceptance (binary)
- A1: report quotes T1's failing output from step 1 and its passing result
  after step 2.
- A2: `tsc --noEmit` exit 0; `vitest run src/server src/lib/api` exit 0 with
  zero failed tests (the pre-existing suite covers POST/CSRF/envelope, so
  MP2-R2 is verified by it staying green).
- A3: `git diff <pre-commit>..HEAD --stat` lists exactly the four owned
  source/test files.
- A4 (orchestrator, after central rebuild + service restart): WP-B re-run
  contains zero `Unrecognized key(s) in object: 'payload'` bodies.
- A5 (orchestrator, same re-run): previously-passing routes still PASS.

## Out of scope
- Any `*.functions.ts` schema change (`.strict()` stays).
- `src/lib/api/client.ts`, UI components, `scripts/verify-screens.mjs`.
- Build, deploy, `systemctl` — orchestrator does these centrally after the
  diff gate.
- The `/terminal` WS 404 (AN-001 §5: test-environment artifact, not a code
  defect) and the silent-error UX on `/network` (separate decision).
- Class (b)/(c) defects — expected to clear once (a) is fixed; re-verified
  by the WP-B re-run, any survivors get their own micro-plans.
