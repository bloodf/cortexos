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
- existing/new tests for each touched component (same __tests__ homes);
- Report: artifacts/impl-mp-026-report.md (never committed).

## Tasks — TDD ORDER (per component; split checkpoints)
0. RED set (write ALL before any implementation; quote failures):
   (i) StatusHero test: mounted with mocked LIVE client returning 2
   services + system stats, renders them; asserts the component module
   has NO import from "@/mocks" (a literal source assertion via reading
   the file in the test is acceptable: expect no match for /@\/mocks/).
   (ii) IncidentToaster test: with live alert-history mock returning a
   NEW entry after mount, a toast fires once (and not for pre-existing
   entries); no "@/mocks" import.
   (iii) CommandPalette test: palette lists services from the mocked
   LIVE client; no "@/mocks" import; no drift import.
   (iv) Network test: page renders WITHOUT the topology section.
   (v) Root test (or grep gate): __root.tsx has no drift import.
1-4. GREEN per component in the order above; each checkpoint quoted.
5. queryKey collision audit (binary): a script/grep proving every
   queryKey literal in src (excl. tests/mocks) maps to exactly ONE
   queryFn source module — quote the audit table; collisions = FAIL.
## Gates (binary, quote)
- tsc 0; full suite zero failures (> MP-025's total); build 0;
  format:check 0;
- `grep -rn 'from "@/mocks' src --include='*.ts*' | grep -v __tests__ |
  grep -v 'src/mocks/' | grep -cv 'import type\|BRAND_COLORS'` → 0
  (type-only + the BRAND_COLORS constant are the ONLY permitted mock
  references; quote the survivors list);
- `grep -c 'startDrift' src/routes/__root.tsx` → 0.
Commit: feat(dashboard-next): production de-mock — live hero/toaster/palette, drift engine removed, topology dropped (MP-026)
## Out of scope: deleting src/mocks/** (tests still use fixtures);
  re-adding topology (future, real source); MP-027 items.
