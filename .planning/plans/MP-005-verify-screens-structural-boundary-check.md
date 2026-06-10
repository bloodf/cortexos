# MP-005 — verify-screens: structural error-boundary detection (kill the body-text false positive)

## Requirements
- MP5-R1: verification run 5 (`.planning/harness/artifacts/screen-defects-5.md:32`)
  failed `/processes` with `error-boundary text present: "This page didn't
  load"` — a FALSE POSITIVE.
  Decisive evidence — `.planning/harness/artifacts/recon-processes-msg.md`
  (structural DOM walk): :8 "No ErrorComponent ... boundary renders on
  /processes"; :97-99 — the phrase exists only inside the PROCESS COMMAND
  column because running harness worker processes carry prompt text
  containing that phrase in their command lines.
  Supporting — `.planning/harness/artifacts/recon-processes-ssr.md`:20-24
  (SSR HTML clean: `grep -c` → 0) and :36-42 (journal clean).
  SUPERSEDED CLAIM, do not rely on it: recon-processes-ssr.md:63
  (`errorBoundaryCount 3`) and :100 ("error is thrown and caught ... then
  recovers") — that count came from the SAME flawed substring text-search
  this plan removes, and the msg recon's element-level walk disproved its
  interpretation; only the SSR/journal sections of that report remain valid.
  Cause: `scripts/verify-screens.mjs:212-218` checks
  `bodyText.includes(sig)` against the WHOLE page innerText
  (`page.locator('body').innerText()`, :213), so any page that displays
  arbitrary system data (process argv, log lines, audit entries) can echo
  a signature and fail falsely.
- MP5-R2: detection must remain sensitive to every real error surface in
  the app (all verified by source):
  - `src/routes/__root.tsx` ErrorComponent → `<h1>` "This page didn't
    load" (quoted in recon-processes-ssr.md:80-84).
  - `src/components/PageHeader.tsx:15-16` — title renders as `<h1>`,
    description as `<p>`, both inside a `<header>` element.
  - Per-route error components use PageHeader:
    `src/routes/_authenticated.docker.$id.tsx:48-53` errorComponent →
    `PageHeader title="Container error" description={error?.message ??
    "Failed to load"}` (signature can appear ONLY in the `<header><p>`);
    `src/features/Systemd.tsx:224` → `title="Failed to load units"` (h1).
  - Error states rendered via EmptyState:
    `src/components/EmptyState.tsx:10` renders its title as `<h3>`;
    `src/routes/_authenticated.docker.$id.tsx:170` uses
    `EmptyState title="Failed to load container"` on its isError path.
  Therefore the structural selector MUST cover `h1, h2, h3,
  [role="alert"], header p` — and that set excludes data-table cells,
  where the false positive lived.

## File ownership (exclusive — touch nothing else)
- `packages/dashboard-next/scripts/verify-screens.mjs`
- Report file (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-005-report.md`

## Tasks (TDD order)
1. RED (executable): write a throwaway script under /tmp that launches
   playwright chromium and defines the four fixtures below. First run them
   through the CURRENT logic (substring on `body` innerText, as at :213-215):
   - F1 `<header><div><h1>This page didn't load</h1><p>x</p></div></header>`
   - F2 `<header><div><h1>Container error</h1><p>Failed to load</p></div></header>`
   - F3 `<table><tbody><tr><td>This page didn't load</td></tr></tbody></table>`
   - F4 `<h3>Failed to load container</h3>`
   RED assertion: F3 MATCHES under the current logic (count/boolean > 0) —
   the false-positive bug demonstrated. Quote all four results. Also run
   `grep -n "bodyText.includes" packages/dashboard-next/scripts/verify-screens.mjs`
   (currently :215).
2. GREEN: replace the :212-218 block — for each signature, instead of
   `bodyText.includes(sig)`, count structural matches:
   `await page.locator('h1, h2, h3, [role="alert"], header p').filter({ hasText: sig }).count()`
   (or equivalent locator API). A count > 0 pushes the same reason string.
   No other check changes; ERROR_SIGNATURES list unchanged.
3. SENSITIVITY CHECK (executable, binary): re-run the same four fixtures
   through EXACTLY the new selector+filter logic:
   F1 ≥ 1 (root boundary), F2 ≥ 1 (PageHeader-description error),
   F3 = 0 (data-cell echo ignored), F4 ≥ 1 (EmptyState h3 error).
   Quote all four counts in the report; delete the script after.
4. Verify:
   - `node --check packages/dashboard-next/scripts/verify-screens.mjs` exit 0.
   - `pnpm exec eslint packages/dashboard-next/scripts/verify-screens.mjs 2>&1 | grep -c 'no-undef'` → 0.
   - `grep -c 'bodyText.includes' packages/dashboard-next/scripts/verify-screens.mjs` → 0.
5. Commit (one commit):
   `fix(dashboard-next): verify-screens — structural error-boundary check, not body-text substring (MP-005)`

## Acceptance (binary)
- A1: Task-4 checks hold with the stated outputs.
- A2: diff touches only `packages/dashboard-next/scripts/verify-screens.mjs`.
- A3: the RED run (Task 1) quotes F3 matching under the old logic, and the
  Task-3 counts are quoted equal to (F1 ≥1, F2 ≥1, F3 = 0, F4 ≥1).
- A4 (orchestrator, next full run): `/processes` PASSes while harness
  worker processes are running.

## Out of scope
- App source changes (the app is correct).
- Changing ERROR_SIGNATURES contents, other checks, routes, or the
  known-artifact mechanism (MP-004).
