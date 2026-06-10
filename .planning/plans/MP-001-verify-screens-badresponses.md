# MP-001 — print badResponses detail in verify-screens.mjs FAIL DETAIL

## Requirement
- MP1-R1: R1 (docs/rebuild/HANDOFF.md:19-26) requires capturing "the URL +
  response body of every non-2xx server-fn response". The script's existing
  capture filter is `status >= 400 && !isAsset` — it skips 3xx. Accepted
  deviation, in scope of R1's intent: the defects under investigation are
  HTTP 400s — every class (a) entry D-003 through D-033 in
  screen-defects.md reads "HTTP status: 400" — and the existing >=400
  filter captures all of them. Widening capture below 400 would add no
  evidence for any open defect, so MP-001 prints what is already captured
  and does NOT widen the filter. WP-B's report
  (.planning/harness/artifacts/screen-defects.md) has every class (a) entry
  as "unknown (not captured in output)" — D-003 through D-033 — because the
  script collects this data but never prints it.
- Evidence: `packages/dashboard-next/scripts/verify-screens.mjs`
  - :144-163 — capture condition is `status >= 400 && !isAsset` (isAsset =
    js/css/image/font URL regex, :150); pushes
    `{ status, method, url, body }` with body truncated to 400 chars
    (:154). The "same-origin server-fn" wording at :148 is a comment, not
    a filter — any non-asset >=400 response is captured.
  - :238 — `badResponses: badResponses.slice(0, 8)` stored per route result.
  - :267-285 — FAIL DETAIL prints `consoleErrors` (:275-278) and
    `failedRequests` (:279-282) but has no loop over `badResponses`.
    Reproduce the absence: `grep -n 'badResponses' packages/dashboard-next/scripts/verify-screens.mjs`
    → hits at capture (144,158,217,218,238) and none between 267-285.

## File ownership (exclusive)
- `packages/dashboard-next/scripts/verify-screens.mjs` — the ONLY file this
  plan may touch.

## Tasks (TDD order)
1. RED: record the failing check — run
   `grep -c '4xx/5xx server-fn responses:' /opt/cortexos/.planning/harness/artifacts/wp-b-screen-defects.log`
   (this file is the captured stdout of the script's last full run, made by
   the WP-B recon worker; the orchestrator verified on 2026-06-10 that the
   file exists and reproduced this check: output `0`, exit code 1). Quote the command and its output in the report.
   If the log file is missing, fall back to proving the printer gap in
   source: `awk 'NR>=267 && NR<=285' packages/dashboard-next/scripts/verify-screens.mjs | grep -c badResponses`
   must output 0.
2. GREEN: in the FAIL DETAIL loop (after the `failedRequests` block,
   verify-screens.mjs:282), add a block that, when `r.badResponses.length`
   is non-zero, prints a `  4xx/5xx server-fn responses:` header and one
   line per entry: `    - <status> <url>\n      body: <body>`. Match the
   existing print style exactly.
3. Verify syntax: `node --check packages/dashboard-next/scripts/verify-screens.mjs`
   exits 0.
4. Commit as one commit: `fix(dashboard-next): print badResponses detail in verify-screens FAIL DETAIL (MP-001)`.

## Acceptance (binary)
- A1: `node --check` exits 0.
- A2: `grep -n 'badResponses' /opt/cortexos/packages/dashboard-next/scripts/verify-screens.mjs`
  now shows a hit inside the FAIL DETAIL section (between the
  failedRequests block and the screenshot line).
- A3: diff touches only `packages/dashboard-next/scripts/verify-screens.mjs`.
- A4: no change to pass/fail logic, exit codes, captured fields, or any
  line outside the FAIL DETAIL printer.
- A5 (behavioral; orchestrator checks it on the first post-MP-001 WP-B
  re-run, before any push): the re-run log contains at least one
  `4xx/5xx server-fn responses:` header, at least one entry line matching
  `- [0-9][0-9][0-9] http`, and at least one `body:` line.

## Out of scope
- Re-running the screen verification (that is the WP-B re-run, dispatched
  separately after this lands).
- Any change to checks, thresholds, routes, session handling, screenshots,
  or truncation length.
- Any other file.
