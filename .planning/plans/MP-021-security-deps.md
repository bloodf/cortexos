# MP-021 — security dependency fixes (operator-approved "Fix all now")

Evidence: pnpm audit --prod 2026-06-11 — 6 CVEs (2 high / 2 moderate /
2 low); frozen-lockfile drift in the dashboard-next importer
(@electric-sql/pglite added to package.json without lockfile sync).

Units (each: own commit, gates green before next):
- 021a (orchestrator, mechanical): `pnpm install` to reconcile importers;
  `pnpm install --frozen-lockfile` must then pass; commit pnpm-lock.yaml.
- 021b (kimi): transitive CVE bumps —
  cortex-telemetry: @traceloop chain so @opentelemetry/sdk-node>=0.217.0
  and uuid>=11.1.1 (HIGH exporter crash + MODERATE uuid);
  cortex-mail-guardian: ai>=5.0.52 (LOW whitelist bypass; pulls
  jsondiffpatch>=0.7.2 fixing the MODERATE XSS). Prefer specifier bumps +
  pnpm update; pnpm.overrides ONLY if ranges cannot reach the patched
  versions (document). Gates: telemetry suite, mail-guardian build+test,
  `pnpm audit --prod` shows only drizzle + the unpatched low remaining.
- 021c (kimi): drizzle-orm ^0.36.0 → ^0.45.2 in dashboard-next (HIGH SQL
  injection). Adapt any changed APIs (repos under src/server/db/**).
  Gates: tsc 0; suite 577 zero failures; build; migrate-cli --help
  unchanged; `pnpm audit --prod` shows only the unpatched low.
- 021d (orchestrator): document the unpatched LOW
  (@ai-sdk/provider-utils uncontrolled resource consumption — no patched
  version exists) as known-accepted in GATE-RESOLUTION; deploy (rebuild,
  restart, screens); push.
Acceptance: audit = 1 known-accepted low, 0 otherwise; frozen-lockfile
passes; all suites green; screens 18/18; everything pushed.
