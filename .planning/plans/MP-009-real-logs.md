# MP-009 — real logs in LogStream: host journal on /healthcheck, container logs on Docker views

## Requirements (design: `.planning/analysis/AN-004-real-logs.md`, gate-hardened through 3 cycles, dispositions in GATE-RESOLUTION.md)
- MP9-R1: `LogStream` renders MOCK random lines (`makeLine()`,
  `src/components/LogStream.tsx:21-27`) at all three mounts
  (`src/features/Healthcheck.tsx:85`,
  `src/routes/_authenticated.docker.$id.tsx:291`,
  `src/features/Docker.tsx:414` — verified grep in AN-004 "Call-site
  verification"). Operator approved replacing mock with real logs.
- MP9-R2 (AN-004 §3, recommendation (a)): polling `createServerFn` RPC —
  the only ADR-001-compliant transport. No WS/SSE; no sidecar coupling.
- MP9-R3 (AN-004 §4, all binding):
  - New `containerLogs` GET fn in `src/lib/api/docker.functions.ts`
    calling `tailLogs(id, n)` (`src/server/docker/real-data.ts:179`,
    returns `Promise<string[]>`). Schema: `id` hex regex max 64, `limit`
    int 1..500. `auth: "admin"` (container logs can expose secrets;
    matches `dockerAction` gating). STDERR: extend `tailLogs` to merge
    CLI stdout+stderr (docker logs writes the container's stderr stream
    to CLI stderr; currently dropped).
  - New `listHostLogs(limit)` in `src/server/system/systemd.ts` running
    `journalctl -n <limit> --no-pager --output=json` WITHOUT `--unit`
    (execFile fixed-argv like `listLogs`); new `hostLogs` GET fn in
    `src/lib/api/systemd.functions.ts`, `auth: "admin"`, NO `getUnit`
    precondition, same rate-limit/audit shape as `unitLogs` (:184-205).
  - `LogStream` gains `fetcher?: () => Promise<string[]>` +
    `refetchIntervalMs?` props: when `fetcher` is set, lines come from
    `useQuery` polling; the mock generator remains ONLY as the
    no-fetcher fallback (used nowhere after this plan). Keep `paused`,
    `clear`, `height`, `max` UX.
  - Data shapes: docker fetcher passes `string[]` through; systemd
    fetchers map each `SystemdLogLine` to `[timestamp] PRIORITY unit:
    message` (AN-004 data-shape note).
  - Hydration guard (binding): SSR initial markup stays the empty list;
    `src/components/__tests__/logstream-hydration.test.tsx` must remain
    green (this package has no query dehydration — AN-004/AN-002
    zero-match grep).
- MP9-R4: call sites — `Healthcheck.tsx` uses a `hostLogs` fetcher;
  `_authenticated.docker.$id.tsx` and `Docker.tsx` use `containerLogs`
  fetchers with their container ids.

ALL commands run from `/opt/cortexos`; paths repo-relative under
`packages/dashboard-next/` unless absolute.

## File ownership (exclusive — touch nothing else)
- `src/components/LogStream.tsx`
- `src/components/__tests__/logstream-hydration.test.tsx` (assertions may
  need updating for the fetcher prop; determinism contract unchanged)
- `src/lib/api/docker.functions.ts`
- `src/lib/api/systemd.functions.ts`
- `src/server/docker/real-data.ts` (tailLogs stderr merge only)
- `src/server/system/systemd.ts` (listHostLogs addition only)
- `src/lib/api/__tests__/docker.functions.test.ts` (add containerLogs cases)
- `src/lib/api/__tests__/systemd.functions.test.ts` (add hostLogs cases)
- `src/server/docker/__tests__/real-data.test.ts` (existing or new — the
  tailLogs stderr-merge test from Task 1 lives here)
- `src/features/Healthcheck.tsx`, `src/features/Docker.tsx`,
  `src/routes/_authenticated.docker.$id.tsx` (fetcher wiring only)
- Report (never committed):
  `/opt/cortexos/.planning/harness/artifacts/impl-mp-009-report.md`

## Tasks (TDD order; env for all test runs:
`set -a; source /opt/cortexos/.secrets/dashboard.env; set +a` — NODE_ENV
pin comes from vitest.config after MP-008)
1. RED: add failing tests, all quoted:
   - Pipeline cases (node-env harness pattern, like the existing cases in
     those `__tests__` files) for `hostLogs` and `containerLogs`: happy
     path (admin session → lines array), auth rejection (non-admin →
     401/403 envelope), input rejection (bad id / limit out of range →
     400). They MUST fail (fns don't exist).
   - stderr-merge case: a `tailLogs` test where the docker invocation
     (mocked per the existing test pattern in that file) emits lines on
     BOTH stdout and stderr; assert the returned array contains both.
     MUST fail before the merge.
   - Component case in `logstream-hydration.test.tsx`: `<LogStream
     fetcher={fakeFetcher} />` renders the fetcher's lines after mount
     (and SSR markup stays the deterministic empty list). MUST fail
     before the prop exists.
2. GREEN server-side: `listHostLogs` + `hostLogs`; `tailLogs` stderr
   merge; `containerLogs`. The Task-1 PIPELINE and stderr-merge tests now
   pass (quote); the Task-1 COMPONENT fetcher test remains RED at this
   point by design.
3. LogStream `fetcher` + `refetchIntervalMs` props + call-site wiring
   (MP9-R4). NOW the Task-1 component fetcher test passes (quote), and
   the hydration determinism assertion stays green (two renders →
   identical markup).
4. Full gates: `tsc --noEmit` exit 0; full `vitest run` zero failures
   (MP-008 baseline: zero known failures remain); lint before/after
   problem-count comparison on owned files (no increase, zero no-undef).
5. ONE commit:
   `feat(dashboard-next): real logs — host journal on healthcheck, container logs on docker views (MP-009)`

## Acceptance (binary)
- A1: Task-1 RED and Task-2/4 GREEN summaries quoted; full suite zero
  failures.
- A2: diff touches exactly the twelve owned files listed in File
  ownership (count the stat lines of the commit against that list).
- A3 (delta counts): record
  `grep -c 'auth: "admin"' <file>` for `docker.functions.ts` and
  `systemd.functions.ts` BEFORE and AFTER — each increases by exactly 1
  (the new gate), quoted in the report.
- A4: `grep -rc 'makeLine' src/features src/routes` → 0 (mock only as
  internal fallback inside `LogStream.tsx`; no call site uses it).
- A5 (stderr, binary): the Task-1 stderr-merge test passes in GREEN
  (quoted), and `grep -c 'stderr' src/server/docker/real-data.ts` ≥ 1
  inside `tailLogs` (visible in the quoted diff hunk).
- A7: the Task-1 component test exercises `refetchIntervalMs` (a custom
  interval value passed and honored — e.g. fake timers advance by the
  custom interval and the fetcher is called again); quoted passing in
  GREEN.
- A6 (orchestrator, after rebuild + restart, binary): screen verification
  run — `node packages/dashboard-next/scripts/verify-screens.mjs` with
  `/opt/cortexos/.secrets/dashboard.env` sourced (the established
  procedure from `.planning/harness/prompts/recon-wp-b*.md`) — 18/18
  PASS; plus a one-shot playwright probe of /healthcheck (minted
  admin session, networkidle + one refetch interval): the LogStream
  container's innerText contains ≥1 line matching the ISO-timestamp regex
  `\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}` (journal lines carry timestamps; the
  retired mock's format also did, so additionally assert the text does NOT
  contain the mock marker strings from the old MESSAGES list — both
  predicates binary).

## Out of scope
- WS/SSE streaming, sidecar changes, new dependencies.
- Removing the mock generator entirely (kept as explicit fallback).
- Any auth/pipeline change beyond the two new gates.
