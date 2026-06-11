# MP-027 — delete the orphaned admin set; truthful adapters

Evidence: recon-fable-dashboard-review.md MEDIUM (grep-proven zero
mounts of src/features/admin/*; lossy adapters client.ts:448-449,:555).

## File ownership (NOTHING else)
- DELETE src/features/admin/** (orphan set — first re-prove zero mounts:
  `grep -rn "features/admin" src --include='*.tsx' --include='*.ts' |
  grep -v 'features/admin/'` → empty, quote);
- src/lib/api/client.ts (the two adapter sites) + the consuming
  components' rendering of null (Incus.tsx / Docker.tsx cells as
  needed) + their tests;
- Report: artifacts/impl-mp-027-report.md (never committed).

## Tasks — TDD ORDER
0. RED: adapter tests — incus instance with null cpu/memory maps to
   null (not 0) and the cell renders "—"; docker volume with null size
   renders "—" — FAIL; quote.
1. GREEN: adapters carry null; cells render "—"; quote.
2. Orphan deletion: re-prove zero mounts (quote), `git rm -r
   src/features/admin`, tsc proves nothing referenced them.
## Gates: tsc 0; full suite zero failures; build 0; format:check 0;
  `ls src/features/admin 2>&1` → No such file (quote).
Commit: chore(dashboard-next): remove orphaned admin page set; null-truthful incus/docker adapters (MP-027)
## Out of scope: any mounted page redesign; mocks directory.
