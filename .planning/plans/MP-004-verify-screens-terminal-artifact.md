# MP-004 — verify-screens: classify the direct-:3080 terminal WS error as environment artifact

## Requirements
- MP4-R1: defect D-003 in `.planning/harness/artifacts/screen-defects-3.md` —
  `/terminal` FAILs on the console error `WebSocket connection to
  'ws://127.0.0.1:3080/terminal/ws' failed ... 404`. This is a
  test-environment artifact, not a code defect, per two gated/recon sources:
  - AN-001 §5 (`.planning/analysis/AN-001-payload-validation.md`): the app
    intentionally exposes no WS route; Caddy proxies `/terminal/ws` to the
    cortex-terminal sidecar on :3081; the UI degrades to its designed mock
    fallback (`src/features/Terminal.tsx:29-34`).
  - `.planning/harness/artifacts/recon-d001-d003.md` Diagnostic 2:
    `cortex-terminal.service` active, :3081 listening, WS endpoint answers
    (403 without auth = handler present), Caddyfile route present.
  The verification harness hits `http://127.0.0.1:3080` directly (bypassing
  Caddy), so this error is inherent to the test setup, not the product.
- MP4-R2: the allowlist must be narrow — exactly this one error pattern on
  exactly this route, only when the target host bypasses Caddy — and must be
  visibly reported, not silently swallowed.

## File ownership (exclusive — touch nothing else)
- `packages/dashboard-next/scripts/verify-screens.mjs`
- Report file (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-004-report.md`

## Tasks (TDD order)
1. RED: record the failing state — quote from
  `.planning/harness/artifacts/screen-defects-3.md` the D-003 entry showing
  `/terminal FAIL 1 console error(s)` with the WS-handshake message, and
  verify the script currently has no artifact-allowlist:
  `grep -c 'KNOWN_ENV_ARTIFACTS\|known-artifact' packages/dashboard-next/scripts/verify-screens.mjs`
  must output 0.
2. GREEN: in `verify-screens.mjs`, add a `KNOWN_ENV_ARTIFACTS` list with one
  entry: `{ route: '/terminal', pattern: /WebSocket connection to 'ws:\/\/127\.0\.0\.1:3080\/terminal\/ws' failed/,
  reason: 'direct-:3080 run bypasses Caddy /terminal/ws→:3081 (AN-001 §5; recon-d001-d003)' }`.
  In the per-route check, console errors matching an entry for that route do
  NOT count toward FAIL but ARE printed in the report as
  `known-artifact: <reason>` under the route. No other check changes.
3. Verify: `node --check packages/dashboard-next/scripts/verify-screens.mjs`
  exits 0.
4. Commit (one commit):
  `chore(dashboard-next): verify-screens — classify direct-:3080 terminal WS error as known env artifact (MP-004)`

## Acceptance (binary)
- A1: `node --check` exit 0.
- A2: `grep -c 'KNOWN_ENV_ARTIFACTS' scripts/verify-screens.mjs` ≥ 2
  (definition + use), and the diff shows the artifact is printed, not
  dropped.
- A3: diff touches only `packages/dashboard-next/scripts/verify-screens.mjs`.
- A4 (orchestrator, next full run): `/terminal` PASSes with the
  `known-artifact` line visible in the run log; no other route's failure
  behavior changes.

## Out of scope
- Any app source change (the product is correct; only the harness
  classification changes).
- Pointing the harness at the Caddy origin (alternative rejected for now:
  needs TLS hostname + cookie-domain handling; revisit if more
  Caddy-dependent features land).
- Any other console-error suppression — the allowlist stays at exactly one
  entry.
