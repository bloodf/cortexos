# MP-026 — remove the mock-data engine from production (operator: "wire live, drop what can't be")

Evidence: recon-fable-dashboard-review.md CRITICAL-2 + CRITICAL-3
(file:line for every mount, import, and queryKey collision). DEPENDS ON
MP-025 (api.alerts.history etc. must be live first).

## File ownership (NOTHING else)
- src/routes/__root.tsx (remove startDrift import + call);
- src/components/StatusHero.tsx (mock api → live "@/lib/api/client");
- src/components/IncidentToaster.tsx (live alert history polling);
- src/app/CommandPalette.tsx (live api; drop mocks/api + drift live());
- src/features/Network.tsx (REMOVE the NetworkTopology mount + import);
- DELETE src/components/NetworkTopology.tsx;
- test files (EXACT): src/components/__tests__/status-hero.test.tsx
  (new), src/components/__tests__/incident-toaster.test.tsx (new),
  src/app/__tests__/command-palette.test.tsx (new),
  src/features/__tests__/network.test.tsx (new or existing);
  all under packages/dashboard-next/;
- Report: artifacts/impl-mp-026-report.md (never committed).

## Tasks — TDD ORDER (per component; split checkpoints)
0. RED set (write ALL before any implementation; quote failures):
   (i) StatusHero test: mounted with mocked LIVE client (api.services —
   live WP-10; api.system — live WP-14, client.ts:896-900 per review
   ADDENDUM 2) returning 2 services + system stats, renders them; asserts the component module
   has NO import from "@/mocks" (a literal source assertion via reading
   the file in the test is acceptable: expect no match for /@\/mocks/).
   (ii) IncidentToaster test: with live alert-history mock returning a
   NEW entry after mount, a toast fires once (and not for pre-existing
   entries); no "@/mocks" import.
   (iii) CommandPalette test: palette lists services from the mocked
   LIVE client; no "@/mocks" import; no drift import.
   (iv) Network test: page renders WITHOUT the topology section.
   (v) grep gate ONLY (no test file): the startDrift grep below → 0.
1-5. GREEN per RED item (i)→(v) in order — five explicit checkpoints,
   each quoted ((v) = the __root.tsx drift removal, proven by the grep
   gate below going to 0).
6. queryKey collision audit (binary, exact commands from
   /opt/cortexos/packages/dashboard-next):
   (a) `grep -rn 'queryKey: \["network"\]' src --include='*.tsx' | grep -v __tests__ | wc -l`
       → 1 (only Network.tsx — the topology consumer is deleted);
   (b) for each file matching
       `grep -rln 'queryKey: \["services"\]\|queryKey: \["system"\]\|queryKey: \["alerts"' src --include='*.tsx' | grep -v __tests__`,
       `grep -n 'from "@/mocks/api"\|from "@/mocks/drift"' <file>` → no
       matches (every consumer of the shared keys now fetches from the
       live client; with one fetcher per key, sharing is harmless).
       Quote the file list + per-file grep results as the audit table.
## Gates (binary, quote)
- `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` → exit 0;
- `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
  → zero failures, total strictly greater than the MP-025-fix run's
  quoted total (read it from impl-mp-025-report.md and quote both);
- `pnpm --filter @cortexos/dashboard-next build` → exit 0;
- `pnpm run format:check 2>&1 | tail -1` → exit 0;
- from /opt/cortexos/packages/dashboard-next:
  `grep -rn 'from "@/mocks' src --include='*.ts*' | grep -v __tests__ |
  grep -v 'src/mocks/' | grep -cv 'import type\|BRAND_COLORS'` → 0
  (type-only + the BRAND_COLORS constant are the ONLY permitted mock
  references; quote the survivors list);
- `grep -c 'startDrift' packages/dashboard-next/src/routes/__root.tsx`
  (from /opt/cortexos) → 0;
- `test ! -e packages/dashboard-next/src/components/NetworkTopology.tsx && echo deleted`
  → "deleted" (binary file-deletion check).
Commit: feat(dashboard-next): production de-mock — live hero/toaster/palette, drift engine removed, topology dropped (MP-026)
## Out of scope: deleting src/mocks/** (tests still use fixtures);
  re-adding topology (future, real source); MP-027 items.
