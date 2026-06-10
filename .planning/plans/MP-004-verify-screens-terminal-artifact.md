# MP-004 — verify-screens: classify the direct-:3080 terminal WS error as environment artifact

## Requirements
- MP4-R1: defect D-003 at
  `.planning/harness/artifacts/screen-defects-3.md:23-25` —
  `/terminal` FAILs on the console error `WebSocket connection to
  'ws://127.0.0.1:3080/terminal/ws' failed ... 404`. This is a
  test-environment artifact, not a code defect, per two gated/recon sources:
  - `.planning/analysis/AN-001-payload-validation.md:162-186` (§5,
    "Test-environment artifact" at :164): the app intentionally exposes no
    WS route; Caddy proxies `/terminal/ws` to the cortex-terminal sidecar
    on :3081; the UI degrades to its designed mock fallback
    (`src/features/Terminal.tsx:29-34`).
  - `.planning/harness/artifacts/recon-d001-d003.md:26-60` (Diagnostic 2):
    `cortex-terminal.service` active (:30-32), :3081 listening (:37-38),
    WS endpoint answers — 403 without auth = handler present (:44-49),
    Caddyfile route present (:55-58).
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
  entry matching the FULL observed message (screen-defects-3.md:25), so any
  other terminal WS failure still FAILs:
  `{ route: '/terminal', pattern: /WebSocket connection to 'ws:\/\/127\.0\.0\.1:3080\/terminal\/ws' failed: Error during WebSocket handshake: Unexpected response code: 404/,
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
- A2 (all from `/opt/cortexos`, all binary):
  - `grep -c 'KNOWN_ENV_ARTIFACTS' packages/dashboard-next/scripts/verify-screens.mjs`
    outputs ≥ 2 (definition + use).
  - Narrowness (MP4-R2), all on the awk slice
    `awk '/const KNOWN_ENV_ARTIFACTS/,/^\];/' packages/dashboard-next/scripts/verify-screens.mjs`:
    piped to `grep -c 'route:'` outputs 1; piped to `grep -c 'pattern:'`
    outputs 1; piped to `grep -c "route: '/terminal'"` outputs 1 (exact
    route); piped to `grep -c 'Unexpected response code: 404'` outputs 1
    (pattern includes the full handshake-404 tail, not just the prefix).
  - Printed-not-dropped: `grep -c "known-artifact" packages/dashboard-next/scripts/verify-screens.mjs`
    outputs ≥ 1 (the report line that surfaces matched artifacts).
- A3: diff touches only `packages/dashboard-next/scripts/verify-screens.mjs`.
- A4 (orchestrator, next full run): binary comparison against the baseline
  PER-ROUTE table at `.planning/harness/artifacts/screen-defects-3.md:31-50`.
  Method: extract `route verdict` pairs from both tables, diff them, and
  judge the diff against this exact expected set —
  (i) `/terminal FAIL → PASS` MUST appear, and the run log MUST contain a
  `known-artifact:` line for `/terminal`;
  (ii) lines for `/overview` and `/healthcheck` are ignored here (owned by
  the D-001 transient check and MP-003 A4 respectively);
  (iii) ANY other diff line — any baseline-PASS route not PASS, any other
  verdict change — fails this acceptance.

## Out of scope
- Any app source change (the product is correct; only the harness
  classification changes).
- Pointing the harness at the Caddy origin (alternative rejected for now:
  needs TLS hostname + cookie-domain handling; revisit if more
  Caddy-dependent features land).
- Any other console-error suppression — the allowlist stays at exactly one
  entry.
