# MP-020a — recon: per-site fix manifest for all 102 findings

Worker: m27-hs (pi, read+bash). READ-ONLY — no file modifications.
Output: `/opt/cortexos/.planning/harness/artifacts/recon-mp020-manifest.md`
(write incrementally). Repo root: /opt/cortexos.

## Tasks
1. Run `pnpm exec eslint . 2>&1 > /tmp/mp020.txt` (minutes — let it
   finish). Confirm total = 102 (quote the ✖ line).
2. For EVERY finding emit one manifest row:
   `| file:line | rule | code excerpt (the flagged line) | fix class A-G per MP-020 |`
   grouped by package, ordered by file.
3. Special analyses (quote evidence for each):
   a. cortex-terminal's 3 n/no-process-exit sites: quote each function;
      identify what keeps the event loop alive at that point (PTY server
      handles, sockets) and whether `process.exitCode + server.close()`
      reaches natural exit; flag any site needing teardown restructure.
   b. The telemetry finding my baseline parsed as "project." — quote the
      raw eslint block; classify it.
   c. dashboard-next import-x/no-extraneous-dependencies ×1: quote the
      import + which manifest the package sits in; recommend correct fix.
   d. The 3 redirect-throw sites NOT matched by the typed allow
      `{ from: 'package', name: 'Redirect', package: '@tanstack/router-core' }`:
      find all 12 `eslint-disable-next-line @typescript-eslint/only-throw-error`
      comments (grep), then for the 3 the allow missed (Task: temporarily
      reason from types — quote each site's `redirect` import source and
      the inferred thrown type) recommend the exact additional allow
      entry (package/name).
   e. The 4 no-bitwise sites (dashboard seed.ts, lovable-error-reporting.ts):
      quote each hash function IN FULL (they become golden-test subjects
      and rewrite targets in MP-020e).
   f. The 12 camelcase sites (audit tests): confirm every one is an
      UNQUOTED snake_case property key in a fixture object (the fix is
      quoting the key — string-literal keys are exempt from camelcase).
   g. The 2 react-hooks/exhaustive-deps disable sites (EnvBrowser.tsx
      ~:77, Terminal.tsx ~:422): quote each effect in full + which deps
      are omitted and why (for MP-020f's restructure design).
4. End with exactly: RECON-COMPLETE or RECON-BLOCKED: <reason>.

## Acceptance
- Manifest rows sum to 102; every row has a fix class; all seven special
  analyses answered with quoted evidence.
