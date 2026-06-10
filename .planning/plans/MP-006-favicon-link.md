# MP-006 — declare an icon link so browsers stop requesting the missing /favicon.ico

## Requirements
- MP6-R1: verification run 6
  (`.planning/harness/artifacts/screen-defects-6.md:13-17`) fails
  `/overview` with the console error `Failed to load resource: the server
  responded with a status of 404 ()`. The resource is `/favicon.ico`:
  - `.planning/harness/artifacts/recon-favicon.md:3-5` — curl of
    `/favicon.ico` → 404;
  - the same message was traced to `http://127.0.0.1:3080/favicon.ico:0`
    in `.planning/harness/artifacts/recon-processes-ssr.md:70-76`;
  - it surfaces on `/overview` because that is the first route the
    verification visits, which is when the browser fetches the favicon.
- MP6-R2: cause — `src/routes/__root.tsx:57` declares only
  `links: [{ rel: "stylesheet", href: appCss }]`
  (`recon-favicon.md:12-13`); the served HTML contains zero `rel="icon"`
  links (`recon-favicon.md:10-11`); with no icon link browsers request
  `/favicon.ico`, and the app has no `public/` directory to serve it
  (`recon-favicon.md:7-8`). Existing asset+pattern to reuse: `cortexos-mark.svg` is already
  imported in `packages/dashboard-next/src/routes/login.tsx:5`
  (`import brandMark from "@/assets/cortexos-mark.svg"`).

ALL commands in this plan run from `/opt/cortexos` (repo root); all file
paths are repo-relative.

## File ownership (exclusive — touch nothing else)
- `packages/dashboard-next/src/routes/__root.tsx`
- Report file (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-006-report.md`

## Tasks (TDD order)
1. RED: record the failing state the GREEN change flips — run
   `grep -c 'rel: "icon"' packages/dashboard-next/src/routes/__root.tsx`
   (expect 0) and
   `curl -s http://127.0.0.1:3080/login | grep -o 'rel="icon"' | wc -l`
   (expect 0 — the currently served HTML declares no icon link). Quote
   both. NOTE: `/favicon.ico` itself stays 404 after this change by
   design — the defect is the browser REQUESTING it, which the icon link
   eliminates; the browser-level proof is acceptance A3
   (orchestrator-owned, post-rebuild).
2. GREEN: in `packages/dashboard-next/src/routes/__root.tsx`, import the
   mark (`import brandMark from "@/assets/cortexos-mark.svg";` — same form
   as `packages/dashboard-next/src/routes/login.tsx:5`) and extend the
   `links` array at :57 with
   `{ rel: "icon", type: "image/svg+xml", href: brandMark }`. No other
   change.
3. Verify (env sourced with `export NODE_ENV=test`):
   - `pnpm --filter @cortexos/dashboard-next exec tsc --noEmit` exit 0.
   - `grep -c 'rel: "icon"' packages/dashboard-next/src/routes/__root.tsx` → 1.
   - `pnpm exec eslint packages/dashboard-next/src/routes/__root.tsx 2>&1 | grep -c 'no-undef'` → 0.
4. Commit (one commit):
   `fix(dashboard-next): declare SVG favicon link — stop /favicon.ico 404 (MP-006)`

## Acceptance (binary)
- A1: Task-1 RED outputs and Task-3 outputs quoted as stated.
- A2: diff touches only `packages/dashboard-next/src/routes/__root.tsx`.
- A3 (orchestrator, after central rebuild + restart): the served HTML of
  `/login` contains `rel="icon"`; next full verification run shows
  `/overview` PASS with zero console errors.

## Out of scope
- Adding a `public/` directory, an .ico file, or any binary asset.
- Any other route/head change; PWA manifests; apple-touch icons.
- Build, deploy, systemctl — orchestrator does these centrally.
