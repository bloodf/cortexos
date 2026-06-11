# MP-020c — cortex-telemetry + cortex-mail-guardian → 0 findings

Implementer: kimi. Repo root: /opt/cortexos. Report (append after EVERY
file): `/opt/cortexos/.planning/harness/artifacts/impl-mp-020c-report.md`
Manifest input: `artifacts/recon-mp020-manifest.md`.
Scope: telemetry (18 incl. 1 to-classify) + mail-guardian (28) = 46.

## Tasks
1. RED: `pnpm exec eslint packages/cortex-telemetry packages/cortex-mail-guardian 2>&1 | tail -1`
   → quote (expect 46).
2. telemetry n/no-process-env ×17: consolidate into
   `packages/cortex-telemetry/src/env.js` — the existing readConfig/
   envFlag layer MOVES there (or env.js re-exports it after the raw
   process.env reads relocate); every other file imports the getters.
   Test-fixture process.env mutations: route through a tiny
   `withEnv(overrides, fn)` helper exported from env.js (sets/restores —
   reads/writes live in the scoped module). The MP-020b env-module scope
   glob already covers src/env.js; tests must NOT need their own scope —
   if any fixture still reads process.env directly after the helper,
   restructure the fixture, do not scope.
3. telemetry item 18 (the manifest-classified one): fix per its manifest
   row class.
4. mail-guardian no-await-in-loop ×18 + no-restricted-syntax ×5: add
   `packages/cortex-mail-guardian/src/sequential.ts`
   (`runSequentially<T>(items, fn)` reduce-chain; lint-clean body) and
   convert every flagged loop. The IMAP UID fetch and event/polling
   `for(;;)` loops: convert to recursive async step functions
   (`const loop = async (): Promise<void> => { ...; return loop(); }`
   with the existing exit conditions) — quote each before/after;
   sequencing and retry/backoff semantics IDENTICAL.
5. mail-guardian n/no-process-env ×3: move into
   `packages/cortex-mail-guardian/src/env.ts` (same pattern; the
   MAIL_GUARDIAN_ENV_PATH CLI read included).
6. mail-guardian n/no-process-exit ×1 (CLI entry): exitCode pattern.
7. mail-guardian n/prefer-promises/dns ×1 (dns.ts): replace the callback
   `dns.lookup` with the promises adapter inside the `tls.connect`
   lookup option:
   `lookup: (host, opts, cb) => { dns.promises.lookup(host, opts).then((r) => cb(null, r.address, r.family), cb); }`
   (handle the opts-optional signature per the manifest quote).
8. GREEN: scope eslint → 0 (quote); zero added disables (grep → 0).
9. Gates: `pnpm --filter @cortexos/telemetry test`;
   `pnpm --filter @cortexos/mail-guardian build && pnpm --filter @cortexos/mail-guardian test`;
   format:check exit 0. Quote all. NOTE: mail-guardian is a LIVE service
   (mail-guardian.service or run-context per repo docs) — after commit,
   the orchestrator restarts/verifies it (logged in MP-020g).
10. ONE commit: `fix(lint): MP-020c — telemetry + mail-guardian to zero`
    Do NOT stage .planning/**. NEVER push.
End IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: scope 0; repo total drops by exactly 46 (arithmetic quoted).
- A2: zero added disables; zero NEW config scopes (reuses MP-020b's).
- A3: gates green; loop conversions each quoted before/after.
