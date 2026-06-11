# MP-020b — contracts + cortex-audit → 0 findings

Implementer: kimi. Repo root: /opt/cortexos. Report (append after EVERY
file): `/opt/cortexos/.planning/harness/artifacts/impl-mp-020b-report.md`
Manifest input: `artifacts/recon-mp020-manifest.md` (file:line per item).
Scope: contracts (2) + cortex-audit (27) = 29 findings.

## Tasks
1. RED: `pnpm exec eslint packages/contracts packages/cortex-audit 2>&1 | tail -1`
   → quote (expect 29 problems).
2. contracts no-console ×1 (scripts/build-json-schemas.mjs): replace the
   `console.log` success line with `process.stdout.write(<same text> + "\n")`
   — byte-identical output.
3. contracts import-x/no-extraneous-dependencies ×1 + the scripts-glob
   class: in eslint.config.js add the SINGLE approved scope —
   `'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }]`
   for files `['packages/*/scripts/**']` with
   `// MP-020: build scripts consume devDependencies by design`.
4. audit camelcase ×12 (test fixtures): QUOTE each snake_case property
   key (`occurred_at:` → `"occurred_at":`) — string-literal keys are
   exempt from camelcase; fixture values and assertions unchanged.
5. audit n/no-process-exit ×7 (bin/cortex-audit.js): convert each
   `process.exit(N)` to `process.exitCode = N; return;` (restructure to
   early-return from the enclosing function; ensure nothing else runs
   after — quote each before/after). The process must still terminate
   naturally (no open handles in the CLI after main returns).
   Verify: `node bin/cortex-audit.js --help; echo rc=$?` → prints usage,
   rc as before.
6. audit n/no-process-env ×7: create `packages/cortex-audit/src/env.js`
   exporting the named getters the call sites need; move every read into
   it; call sites import from it. Add the env-module scope line in
   eslint.config.js (`n/no-process-env: off` for
   `packages/*/src/env.{js,ts}` — one entry covers MP-020c too) with
   `// MP-020: env reads live ONLY in designated env modules`.
7. audit no-restricted-syntax ×1: per the manifest row — if it is the
   sequential hash-chain validation loop, add
   `packages/cortex-audit/src/sequential.js` (`runSequentially` —
   reduce-chain implementation, lint-clean body) and convert; ordering
   preserved by construction.
8. GREEN: scope eslint → `✖ 0 problems` (quote). No eslint-disable added:
   `git diff | grep -cE '^\+.*eslint-disable'` → 0.
9. Gates: `pnpm --filter @cortexos/contracts build && pnpm --filter @cortexos/contracts test`;
   `pnpm --filter @cortexos/audit test`; `node --check` every edited .js;
   `node bin/cortex-audit.js --help` rc unchanged;
   `pnpm run format:check 2>&1 | tail -1` exit 0. Quote all.
10. ONE commit: `fix(lint): MP-020b — contracts + cortex-audit to zero`
    Do NOT stage .planning/**. NEVER push.
End IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: scope eslint 0; repo total drops by exactly 29 (quote arithmetic).
- A2: zero added disables; exactly the 2 approved config scope edits.
- A3: gates green; CLI rc behavior unchanged.
