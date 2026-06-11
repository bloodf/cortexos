# MP-020 — drive the 102 adjudicated findings to ZERO before release

## Operator directive
Fix all 102 remaining findings (previously adjudicated-accepted) before
release, using the CLI worker harness. Baseline (orchestrator capture
2026-06-11, durable artifact
`.planning/harness/artifacts/recon-mp020-baseline.txt`, sums to 102):

| Count | Package | Rule |
|---|---|---|
| 18 | mail-guardian | no-await-in-loop |
| 17 | telemetry | n/no-process-env |
| 12 | dashboard-next | no-await-in-loop |
| 12 | audit | camelcase (test fixtures) |
| 7 | audit | n/no-process-exit |
| 7 | audit | n/no-process-env |
| 5 | dashboard-next | no-underscore-dangle |
| 5 | mail-guardian | no-restricted-syntax |
| 4 | dashboard-next | no-bitwise |
| 3 | terminal | n/no-process-exit |
| 3 | mail-guardian | n/no-process-env |
| 7 | (stragglers) | see §G |
| 1 | telemetry | parse artifact — W0 verifies |
| 1 | audit | no-restricted-syntax |

## Fix strategies per class (binding)

### A. Sequential awaits + paired for...of — 36 (MG 18+5, DN 12, audit 1)
Introduce ONE tiny helper per package (no new dependencies):
`runSequentially(items, fn)` — an internal reduce-chain or recursive
implementation whose own body is lint-clean; loops convert to
`await runSequentially(items, async (item) => {...})`. Strictly
sequential, behavior-identical. `for (;;)` retry/poll loops convert to a
recursive `async function loop()` step pattern. Each site quoted
before/after in the report; order-dependence preserved BY CONSTRUCTION.

### B. process.env centralization — 27 (telemetry 17, audit 7, MG 3)
Per package: ONE designated env module (`src/env.js|ts`) owns every
`process.env` read; all scattered reads move to imports from it
(telemetry's readConfig/envFlag already is this layer — consolidate into
it). The designated module itself + test fixtures that mutate
process.env get a NARROW config scope (`n/no-process-env: off` for
`**/src/env.{js,ts}` and the test globs) with `// MP-020:` rationale —
reading process.env inside the env module is irreducible; this encodes
"env reads only in env modules" as an enforced architecture rule.
~20 code moves + 1 scoped allowance.

### C. process.exit → exitCode pattern — 11 (audit 7, terminal 3, MG 1)
CLI bins: `process.exitCode = N; return;` — lint-clean,
behavior-equivalent (natural exit after main returns). Sidecar
(cortex-terminal, 3 sites): per-site analysis in W0; fatal paths use
`process.exitCode = 1` + `server.close()`; if open PTY handles prevent
natural exit, that site is restructured so teardown closes them.
MANDATORY verification: `sudo systemctl restart cortex-terminal.service`
+ failure-injection check that systemd Restart= behavior still recovers
the service (W3 gate).

### D. camelcase DB-mirror fixtures — 12 (audit tests)
The fixtures MUST emit snake_case rows (they mirror what the DB returns
to the code under test); renaming breaks the mirror. Fix: scoped config
`camelcase: ['error', { allow: ['^[a-z0-9]+(_[a-z0-9]+)+$'] }]` for
`packages/cortex-audit/test/**` with `// MP-020:` rationale.
OPERATOR FLAG: the code-only alternative (a row-builder helper mapping
camelCase→snake_case) adds indirection to tests for zero safety gain —
pick at gate time; default is the scoped allowance.

### E. underscore-dangle exported test hooks — 5 (dashboard)
Atomic rename groups (module + ALL importers + test pair edited
consecutively, parse-checked, before any other file — the D3e
failure-mode protocol): `_x` → `xForTests` naming. tsc is the
importer-completeness check.

### F. no-bitwise hash utilities — 4 (dashboard seed.ts, lovable-error-reporting.ts)
Bitwise IS the domain language of hash mixing; non-bitwise rewrites risk
silent output changes. Fix: extract the hash functions into
`src/lib/hash.ts` (single home), scoped `no-bitwise: off` for that one
file with `// MP-020:` rationale. OPERATOR FLAG: the code-only
alternative (Math.imul + unsigned emulation) is available but
error-prone; default is extract+scope.

### G. Stragglers — 7
- DN `prefer-arrow-callback` (client.test.ts:18): hoist a named
  `function MockPool()` declaration and pass the reference — lint-clean,
  `new`-able. CODE FIX (closes a proven false positive properly).
- DN `no-unnecessary-type-assertion` (drift.ts:97): type the literal
  (annotation/`satisfies`) so the assertion is genuinely removable; tsc
  must stay green (this file broke twice — HANDS-ON only for this one
  exact change, full suite after). CODE FIX.
- DN `import-x/no-extraneous-dependencies` ×1: W0 identifies the
  import; move the dep to the right manifest section or correct the
  import. Per-site.
- contracts `no-console` (build script): `process.stdout.write(...)` —
  identical output, lint-clean. CODE FIX.
- contracts `no-extraneous-dependencies` (build script devDep): config
  devDependencies allowance for `packages/*/scripts/**` (same class as
  the test-glob allowance). Scoped config.
- MG `n/prefer-promises/dns`: wrap dns.promises in the callback adapter
  `tls.connect` requires:
  `lookup: (h, o, cb) => { dns.promises.lookup(h, o).then(r => cb(null, r.address, r.family), cb); }`
  — promises API used, behavior identical. CODE FIX.
- telemetry parse artifact ×1: W0 identifies; fix or reclassify with
  evidence.

### H. (Optional completion) legacy disables — 14 comments, 0 findings
- 12× only-throw-error on `throw redirect()`: the typed allow caught
  9/12 — W0 identifies the 3 unmatched sites' actual thrown type
  (likely a different package source for `redirect`), extends the allow,
  then ALL 12 comments are removed.
- 2× react-hooks/exhaustive-deps (EnvBrowser, Terminal): real React dep
  surgery (refs/effect-event restructuring) — behavior-sensitive; W5
  only if operator opts in, else the 2 documented disables remain.

## Execution (sequential kimi micro-jobs; pi lanes for recon + reviews)
- W0 RECON (m27-hs via pi): per-site manifest for every class
  (file:line, before/after sketch), sidecar exit-path analysis, the 3
  unmatched redirect types, the parse artifact, the extraneous-dep
  import. Output: `artifacts/recon-mp020-manifest.md`.
- W1 contracts + audit (kimi): §G contracts items, C×7, B×7, A×1, D
  (per operator choice). Commit: `fix(lint): MP-020 W1 — contracts, audit to zero`
- W2 telemetry + mail-guardian (kimi): B consolidation (17+3), A (18+5),
  dns adapter, C×1. Commit: `fix(lint): MP-020 W2 — telemetry, mail-guardian to zero`
- W3 terminal (kimi, high-care): C×3 + service restart verification.
  Commit: `fix(lint): MP-020 W3 — terminal to zero`
- W4 dashboard-next (kimi): A×12, E×5 atomic, F extract, G items, §H
  redirect-allow completion. Commit: `fix(lint): MP-020 W4 — dashboard-next to zero`
- W5 (optional, opt-in): the 2 react-hooks restructures.
- EVERY wave: incremental report writes; checkpoint protocol (orchestrator
  verifies green THEN inspects diff content for suppressions before
  committing — the FINAL CLOSE v2 lesson); gpt-5.5 diff review per
  commit (embedded, chunked if >100KB); package gates per the audit
  table; dashboard waves add tsc + full suite ≥558.

## Acceptance (binary, campaign end)
- A1: `pnpm exec eslint .` → `✖ 0 problems` — true zero.
- A2: zero NEW disable comments
  (`git diff <start>..HEAD | grep -cE '^\+.*eslint-disable'` → 0); the
  12 legacy only-throw-error comments REMOVED (§H); every scoped config
  allowance carries `// MP-020:` rationale (count matches the agreed
  classes: env-modules, audit-test camelcase, hash.ts bitwise,
  scripts devDeps — ≤ 4 scopes).
- A3: full battery green — tsc 0; dashboard 558/558 + build; contracts/
  audit/telemetry/mail-guardian suites; terminal node --check + service
  restart verification; `format:check` exit 0.
- A4: deploy verification — rebuild, boot 200, restart, screens 18/18.
- A5: push only after every wave's diff review is PASS or adjudicated.

## Risks
- Sidecar exit semantics (W3): systemd recovery must be re-verified.
- Sequential-helper conversions: each site's order-dependence preserved
  by construction; reviews specifically check loop conversions (two
  prior real defects were exactly this class).
- Rename churn (E): atomic-group protocol; tsc as completeness gate.
- Worker deaths: checkpoint pattern with CONTENT INSPECTION mandatory.
- drift.ts/client.test.ts: twice-burned files — exact single-change
  prescriptions only.

## Estimate
W0 ~15 min; W1-W4 ~1 worker session each plus review (~25-40 min/wave
with the death-retry pattern); total ~3-5 h wall-clock.
