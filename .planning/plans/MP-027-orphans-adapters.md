# MP-027 — delete the orphaned admin set; truthful adapters

Evidence: recon-fable-dashboard-review.md "## MEDIUM" section (lossy
adapters at client.ts:448-449,:555; orphaned admin set — grep-proven
zero mounts) + ADDENDUM 3 (the consumer cells Incus.tsx:354,
Docker.tsx:291 images / :328 volumes). Anchors quoted by the implementer
in Task 0 via `grep -n 'MEDIUM' <artifact>`.

## File ownership (NOTHING else)
- DELETE packages/dashboard-next/src/features/admin/** (orphan set —
  first re-prove zero mounts FROM /opt/cortexos:
  `grep -rn "features/admin" packages/dashboard-next/src
  --include='*.tsx' --include='*.ts' | grep -v 'features/admin/'` →
  empty, quote);
- packages/dashboard-next/src/lib/api/client.ts (the two adapter
  sites: :448-449 incus cpu/memory, :555 volume size);
- packages/dashboard-next/src/features/Incus.tsx (the cpu/memory cells —
  :354 + adjacent, per review ADDENDUM 3);
- packages/dashboard-next/src/features/Docker.tsx (the bytes(r.size)
  cells — :291, :328);
- test files (EXACT): packages/dashboard-next/src/features/__tests__/
  incus-cells.test.tsx (new) and docker-cells.test.tsx (new), plus the
  adapter assertions inside packages/dashboard-next/src/lib/api/
  __tests__/client-live-surface.test.ts;
- Report: artifacts/impl-mp-027-report.md (never committed).

## Tasks — TDD ORDER
0. BASELINE + RED: first quote the current suite total N via
   `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run 2>&1 | grep -E "Tests "'`
   — the binding baseline. Then RED tests: incus instance with null
   cpu/memory maps to null (not 0) and the cell renders "—"; docker
   VOLUME with null size renders "—" (Docker.tsx:328); docker IMAGE
   with null size renders "—" (Docker.tsx:291) — FAIL; quote.
1. GREEN: adapters carry null; cells render "—"; quote.
2. Orphan deletion: re-prove zero mounts (quote), `git rm -r
   packages/dashboard-next/src/features/admin` (from /opt/cortexos),
   tsc proves nothing referenced them.
## Gates (binary, quote each; all from /opt/cortexos)
- `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` → exit 0;
- `bash -c 'set -a; source /opt/cortexos/.secrets/dashboard.env; set +a; cd packages/dashboard-next && pnpm exec vitest run'`
  → zero failures, total strictly greater than the Task-0 baseline N
  (quote both numbers);
- `pnpm --filter @cortexos/dashboard-next build` → exit 0;
- `pnpm run format:check 2>&1 | tail -1` → exit 0;
- `pnpm exec eslint . > /tmp/z.txt 2>/dev/null; echo rc=$?` → rc=0 AND
  `wc -c < /tmp/z.txt` → 0;
- `ls packages/dashboard-next/src/features/admin 2>&1 | head -1` →
  "No such file or directory" (quote).
Commit: chore(dashboard-next): remove orphaned admin page set; null-truthful incus/docker adapters (MP-027)
## Out of scope: any mounted page redesign; mocks directory.
