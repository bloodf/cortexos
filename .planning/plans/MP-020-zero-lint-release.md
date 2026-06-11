# MP-020 (MASTER) — fix ALL 102 findings to true zero before release

## Operator directive (2026-06-11)
"I want all the items fixed, with a plan with micro plans to fix all the
issues." — every finding CODE-FIXED where technically possible; the only
config items permitted are the THREE architecturally-irreducible ones
below, each a one-liner with `// MP-020:` rationale.

Baseline: `.planning/harness/artifacts/recon-mp020-baseline.txt` — raw
eslint output ending `✖ 102 problems (101 errors, 1 warning)` PLUS an
appended orchestrator-derived per-package/per-rule table (sums to 102).

## Irreducible config items (EXACTLY THREE; everything else is code)
1. `n/no-process-env` off for the ONE designated env module per package
   (`packages/*/src/env.{js,ts}` glob) — a Node process must read
   process.env somewhere; consolidation makes it exactly one file per
   package and the scope ENFORCES that architecture (any new read
   elsewhere = lint error). (MP-020b adds it; MP-020c reuses it.)
2. `import-x/no-extraneous-dependencies` devDependencies allowance for
   `packages/*/scripts/**` — build scripts consuming devDeps is the
   correct manifest layout; promoting build tools to runtime
   dependencies would be wrong. (MP-020b.)
3. `@typescript-eslint/only-throw-error` allow-extension for TanStack's
   Redirect type (completing the existing allow so all 12 legacy disable
   comments DELETE) — framework-required non-Error throws, allowed by
   TYPE, not by suppression. (MP-020e.)
camelcase and no-bitwise — previously flagged for scoping — are
CODE-FIXED (MP-020b quoted keys; MP-020e golden-tested rewrites).
Acceptance everywhere uses this same count: ≤ 3 config items, each
`// MP-020:` commented.

## Micro-plans (execute strictly in order; each is a separate gated unit)
- MP-020a — recon manifest (m27-hs, read-only)
- MP-020b — contracts + cortex-audit → 0
- MP-020c — cortex-telemetry + cortex-mail-guardian → 0
- MP-020d — cortex-terminal → 0 (service-critical)
- MP-020e — dashboard-next → 0 + legacy redirect-disable removal
- MP-020f — react-hooks dep surgery (the last 2 legacy disables)
- MP-020g — final verification + release (orchestrator)

## Protocol (binding for every micro-plan)
- Implementer: kimi. Recon/verify: m27-hs (pi). Diff reviewer: gpt-5.5
  (pi, embedded diffs, chunk >100KB). Author ≠ reviewer always.
- Incremental report writes after EVERY file; worker-death recovery =
  verify tree (tsc/tests) → orchestrator CONTENT-INSPECTS diff (zero
  added eslint-disable; scan for suppression cheating) → checkpoint
  commit → continuation.
- No new dependencies. No eslint-disable comments — additions of any
  disable directive FAIL the wave (binary grep in every acceptance).
- One commit per micro-plan (checkpoints allowed on worker death, same
  message + part N).
- Each wave ends: package gates green + wave-scoped eslint = 0.

## File ownership (campaign-wide)
- Each wave edits ONLY: (a) files under its named package(s); (b) the
  named eslint.config.js items from the three-item list above; (c) NEW
  helper/test files explicitly named in its micro-plan (env modules,
  sequential helpers, golden-test files); (d) its report (never
  committed). DISCOVERED-REFERENCE RULE: an extra functional reference
  required by a rename/move is owned iff tagged
  `[discovered:<path>]` with rationale in the report; anything
  structurally different → IMPL-BLOCKED.

## Out of scope
- Any behavior change (sequencing, exit codes, hash outputs, retrigger
  cadence — all preserved and evidenced per micro-plan).
- New dependencies; package-level eslint configs; historical docs;
  untracked vendored/host content. (.planning/** clarification: workers
  MUST write reports/artifacts under .planning/harness/artifacts/ —
  those are repo-gitignored and NEVER COMMITTED; what is out of scope is
  committing or editing any other .planning content.)
- Rule deletions/global disables beyond the three-item list.

## Campaign acceptance (MP-020g)
- TRUE ZERO, exit-code form (eslint success is SILENT — ledger lesson):
  `pnpm exec eslint . > /tmp/z.txt 2>/dev/null; echo rc=$?` → rc=0 AND
  `wc -c < /tmp/z.txt` → 0 (stdout only — stderr carries an unrelated
  Node module-type advisory).
- `git diff <campaign-start>..HEAD | grep -cE '^\+.*eslint-disable'` → 0;
  the 14 legacy disable comments REMOVED — baseline evidence:
  `.planning/harness/artifacts/recon-legacy-disables.txt` (grep capture,
  12× only-throw-error + 2× react-hooks/exhaustive-deps, 14 lines);
  final check: the same grep returns EMPTY.
- Config items ≤ the THREE above, each `// MP-020:` commented.
- Full battery: tsc 0; dashboard suite ZERO FAILURES at its NEW total
  (the prior 558 + the golden tests MP-020e adds; MP-020e quotes the new
  total N, MP-020g asserts N) + build; contracts 243/243;
  audit/telemetry/mail-guardian suites; terminal node --check + systemd
  restart verification; `format:check` exit 0.
- Deploy: rebuild, boot 200, restart, screens 18/18. Push only after
  every wave review PASS/adjudicated.
