# AN-002: /healthcheck hydration mismatch analysis

## Route and component tree

- **Route file:** `packages/dashboard-next/src/routes/_authenticated.healthcheck.tsx:1-3`
  - Exports `Route` with `component: HealthcheckPage`
- **Feature component:** `packages/dashboard-next/src/features/Healthcheck.tsx:18-89`
  - Renders `PageHeader`, `DataTable`, `Card` (Incident timeline), and `LogStream`
- **Subtree under suspicion:**
  1. `HealthcheckPage` → `LogStream` (`packages/dashboard-next/src/components/LogStream.tsx:32-66`)
  2. `HealthcheckPage` → `DataTable` (`packages/dashboard-next/src/components/DataTable.tsx:62-300`)

---

## Candidate 1 — LogStream initial lines (HIGHEST LIKELIHOOD)

**File:** `packages/dashboard-next/src/components/LogStream.tsx:24-33`

**Snippet:**
```tsx
function makeLine() {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  const src = SOURCES[Math.floor(Math.random() * SOURCES.length)];
  const lvl = LEVELS[Math.floor(Math.random() * LEVELS.length)];
  const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  return `[${ts}] ${lvl.padEnd(5)} ${src.padEnd(8)} ${msg}`;
}

export function LogStream({ height = 480, intervalMs = 700, max = 400 }: ...) {
  const [lines, setLines] = useState<string[]>(() => Array.from({ length: 40 }, makeLine));
```

**Why this is the source:**
- `useState` initializer runs during **SSR** and again during the **client hydration render**.
- Each call to `makeLine()` produces **non-deterministic text**:
  - `new Date().toISOString()` → timestamp differs between server and client by however long the request/transport takes.
  - `Math.random()` → source, level, and message selections are completely uncorrelated between server and client.
- The component renders 40 lines of text via
  `<LogViewer lines={lines} .../>` — `LogViewer` maps each line to a text
  node (`packages/dashboard-next/src/components/LogViewer.tsx:16`:
  `{lines.map((l, i) => ...)`). Any single differing text node triggers
  React error #418 (`args[]=text`).
- The `DataTable` and `StatusBadge` components used on the same page contain
  no time/random-dependent rendering in their initial output — verified by
  the zero-match grep quoted under Candidate 2.

**Minimal fix:**
```tsx
export function LogStream({ height = 480, intervalMs = 700, max = 400 }: ...) {
  const [lines, setLines] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLines(Array.from({ length: 40 }, makeLine));
  }, []);
```
Alternatively, keep the state empty during SSR/hydration and render a placeholder until `useEffect` populates lines client-side after mount.

---

## Candidate 2 — DataTable server-fetch timing (LOW LIKELIHOOD)

**File:** `packages/dashboard-next/src/components/DataTable.tsx:87-93`

**Snippet:**
```tsx
  const serverQuery = useQuery({
    queryKey: server ? [...server.queryKey, "page", page, pageSize, debouncedQ, sortKey, sortDir] : ["__noop__"],
    queryFn: () => server!.fetch({ q: debouncedQ, page, pageSize, sortKey, sortDir }),
    enabled: !!server,
    placeholderData: keepPreviousData,
    refetchInterval: server?.refetchInterval,
  });
```

**Why this is NOT the source (orchestrator-verified 2026-06-10):**
- The exclusion does not depend on whether `useQuery` executes during SSR.
  Whatever the table renders on the server pass (data, skeleton, or empty
  state), its output contains no time/random/locale-dependent text, so it
  cannot produce a server/client text divergence. (For completeness: the
  package has no dehydration wiring —
  `grep -RIn 'dehydrate\|HydrationBoundary' packages/dashboard-next/src`
  → zero matches — but the grep below is the load-bearing evidence.)
- No time/random/locale-dependent rendering in either component. Reproduce:
  `grep -n 'new Date\|Math.random\|toLocaleString\|Date.now' packages/dashboard-next/src/components/DataTable.tsx packages/dashboard-next/src/components/StatusBadge.tsx`
  → zero matches (files exist: 300 and 22 lines respectively, `wc -l`).
- The loading skeletons are deterministic `animate-pulse` divs, not text
  nodes that differ between server and client.

---

## Candidate 3 — relativeTime via ms() or format helpers (RULED OUT)

**File:** `packages/dashboard-next/src/lib/format.ts:27-35`

**Snippet:**
```ts
export function relativeTime(iso: string | number | Date): string {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  ...
}
```

**Why this is NOT the source on /healthcheck:**
- `relativeTime` is imported but **not used** in `Healthcheck.tsx` or `LogStream.tsx`.
- The `ms()` helper used for latency formatting only rounds a number; it is
  deterministic. Implementation (`packages/dashboard-next/src/lib/format.ts:37-40`):
  ```ts
  export function ms(n: number): string {
    if (!isFinite(n) || n < 0) return "—";
    return `${Math.round(n)} ms`;
  }
  ```
- `StatusBadge` uses `t.status[status]` (i18n lookup) and `ms(responseTime)` — both deterministic given the same props.

---

## Ranking

| Rank | Location | Likelihood | Reason |
|------|----------|------------|--------|
| 1 | `LogStream.tsx:25-33` | **Certain** | `new Date()` + `Math.random()` in `useState` initializer executed during SSR and hydration |
| 2 | `DataTable.tsx:87-93` | Low | No SSR fetch, deterministic skeletons |
| 3 | `lib/format.ts:27-35` | Ruled out | Not called by any component on the /healthcheck route |

---

## What the fix must NOT change

- **Data fetching:** The `DataTable` `server` prop and its `useQuery` configuration must remain untouched.
- **Route loader:** `_authenticated.healthcheck.tsx` has no loader; none should be added.
- **Other routes:** `LogStream` may be used elsewhere; the fix should keep the same public API (`height`, `intervalMs`, `max`) and visual behavior after mount.
- **SSR of the page shell:** The `PageHeader`, `Card` wrappers, and `DataTable` should continue to render on the server.

---

## Recommended minimal fix for Candidate 1

In `packages/dashboard-next/src/components/LogStream.tsx`:

1. Change initial state to `[]`.
2. Populate lines inside `useEffect` so generation happens only after client mount.
3. Optionally render a short placeholder (e.g., "Waiting for logs…" or empty) until populated.

Example patch (~5 lines changed):
```tsx
export function LogStream({ height = 480, intervalMs = 700, max = 400 }: ...) {
  const [lines, setLines] = useState<string[]>([]);
  // ...
  useEffect(() => {
    setLines(Array.from({ length: 40 }, makeLine));
  }, []);
```

This eliminates the hydration mismatch because the server and client initial renders are both the empty list, and the randomized log lines are only injected after mount.

---

ANALYSIS-COMPLETE
