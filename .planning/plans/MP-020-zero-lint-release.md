# MP-020 (MASTER) — fix ALL 102 findings to true zero before release

## Operator directive (2026-06-11)
"I want all the items fixed, with a plan with micro plans to fix all the
issues." — every finding CODE-FIXED where technically possible; the only
config scopes permitted are the 4 architecturally-irreducible ones below,
each a one-liner with `// MP-020:` rationale.

Baseline: `.planning/harness/artifacts/recon-mp020-baseline.txt`
(102 findings, per-package/per-rule table verified to sum).

## Irreducible config scopes (the ONLY ones; everything else is code)
1. `n/no-process-env` off for the ONE designated env module per package
   (`packages/{cortex-telemetry,cortex-audit,cortex-mail-guardian}/src/env.*`)
   — a Node process must read process.env somewhere; consolidation makes
   it exactly one file per package and the scope ENFORCES that
   architecture (any new read elsewhere = lint error).
2. `import-x/no-extraneous-dependencies` devDependencies allowance for
   `packages/*/scripts/**` — build scripts consuming devDeps is the
   correct manifest layout; "fixing" by promoting build tools to runtime
   dependencies would be wrong.
(That is 2 scope RULES covering ≤ 4 glob lines total. camelcase and
no-bitwise — previously flagged for scoping — are CODE-FIXED, see
MP-020b/e.)

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

## Campaign acceptance (MP-020g)
- `pnpm exec eslint .` → `✖ 0 problems` (TRUE ZERO).
- `git diff <campaign-start>..HEAD | grep -cE '^\+.*eslint-disable'` → 0;
  the 12 legacy only-throw-error comments REMOVED; the 2 react-hooks
  comments REMOVED (MP-020f).
- Config scopes ≤ the 2 rules above, each `// MP-020:` commented.
- Full battery: tsc 0; dashboard 558/558 + build; contracts 243/243;
  audit/telemetry/mail-guardian suites; terminal node --check + systemd
  restart verification; `format:check` exit 0.
- Deploy: rebuild, boot 200, restart, screens 18/18. Push only after
  every wave review PASS/adjudicated.
