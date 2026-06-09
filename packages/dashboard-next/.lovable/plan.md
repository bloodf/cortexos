## Scope reality check

You're asking for, roughly:
- 21 product improvements (landing, empty states, detail pages, search-everything, charts, bulk actions, scheduler, backups, topology, tour, simulate menu, real i18n, etc.)
- Skeleton loaders everywhere
- A full unit-test suite
- Architectural separation suitable for open-source contributors
- "Very stable and bug-free"

Honestly: that's 40–60 hours of focused work. I'll do it, but in **phases that each leave the app shippable**. After every phase you can stop, redirect, or keep going. I will not try to one-shot this — that's how regressions land.

---

## Phase 1 — Foundation for stability (do first)

Skeletons, test harness, and refactor that everything else depends on.

1. **Skeleton system**
   - `<Skeleton>` primitives: `TableSkeleton`, `CardSkeleton`, `ChartSkeleton`, `RowSkeleton`, `DetailSkeleton`.
   - Replace every `loading={true}` branch and every `?.map` fallback with a real skeleton matching the final layout (no layout shift).
2. **Test harness**
   - Vitest + `@testing-library/react` + jsdom + `@testing-library/user-event`.
   - `src/test/setup.ts`, `src/test/utils.tsx` (renders with QueryClient + Router + I18nProvider).
   - Mock for `mocks/api.ts` and a deterministic seed for tests.
   - CI-ready: `bun test`, coverage threshold 70% for `src/lib`, `src/hooks`, `src/components`.
3. **Folder separation for OSS**
   ```
   src/
     app/          # shell, providers
     components/   # design-system + shared, ALL tested
     features/    # routed pages + page-local components
     hooks/        # all tested
     lib/          # pure utilities, 100% tested
     mocks/        # mock API, seed, drift
     i18n/
     test/
   ```
   Move page-local components out of `features/*.tsx` into `features/<page>/` folders so files stay <250 lines.
4. **Lint + format gate**
   - ESLint with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`.
   - Prettier config + `.editorconfig`.
   - `tsc --noEmit` clean.
5. **CONTRIBUTING.md, README.md, LICENSE (MIT), architecture diagram** so the repo is actually consumable.

Deliverable: app looks the same, but every loading state is real, tests run, contributors can find their way around.

## Phase 2 — Polish & realism (visible wins)

6. Custom **landing/login** with CortexOS wordmark, gradient mesh, demo-user split, animated server-rack motif.
7. **Empty-state illustrations** (lightweight SVGs) per resource.
8. **Status hero** on Overview ("All systems nominal" / pulse animation).
9. **Simulate menu** expanded: CPU spike, fill disk, fail container, expire cert.
10. **TechIcon** sweep — confirm every brand icon resolves, add subtle accent glow.

## Phase 3 — Resource detail pages

11. Real routes: `/docker/$id`, `/incus/$name`, `/systemd/$unit` with tabs (Overview, Logs, Env, Network, Events, Exec console mock).
12. **Time-range charts**: Recharts area charts on Overview + detail pages with 1h/24h/7d toggle backed by the drift simulator's history buffer.

## Phase 4 — Power-user features

13. **Search-everything** in ⌘K — containers, units, users, alerts, audit, with grouped results.
14. **Bulk actions** with checkbox columns on Docker / Systemd / Processes.
15. **Right-click context menu** on table rows.
16. **Saved views / filter chips** persisted per page.
17. **Inline edit** for Incus config with diff preview.
18. **Diff viewer** for env rotation + config changes.

## Phase 5 — New pages & UX completeness

19. `/scheduler` page (timers + cron).
20. `/backups` page (snapshots + restore confirmation).
21. **Network topology** mini-diagram on `/network`.
22. **Demo tour** overlay on first visit.
23. **Toast pipeline** for new incidents (drift simulator → sonner).

## Phase 6 — Accessibility, i18n, print

24. Full a11y axe pass; focus-visible rings everywhere; `<main>` correctness; tap targets ≥ 44px.
25. **Real translations** for `es` and `pt-BR` (currently English mirrors).
26. **Print stylesheet** for audit logs and incident reports.

## Phase 7 — Test coverage push

27. Unit tests for every `src/lib/*` (`format`, `fuzzy`, `status`) → 100%.
28. Unit tests for every hook (`useAuth`, `useFavorites`, `useHotkey`, `useT`, `useUI`, `useKeyboardShortcuts`, `useLocalStorage`).
29. Component tests for design-system primitives (`DataTable` sort/filter/paginate, `LogViewer`, `LogStream` pause/resume, `IncidentTimeline`, `Sparkline`, `MetricCard`, `ConfirmDialog` requireText, `AdminOnly` gating).
30. Smoke render tests per page (mount + key assertions, no console errors).
31. End-of-phase: coverage gate raised to 80% lines, 70% branches.

---

## How I'll run this

- One phase per turn, max. I'll **stop and report** at the end of each phase with: what shipped, test counts, what's still broken.
- If a phase explodes in scope mid-flight, I'll stop early rather than half-finish.
- No phase will silently revert or rewrite work from a previous phase.
- "Bug-free" is impossible to promise, but the test suite + TS strict + a11y lint gives a real safety net.

---

## What I need from you before starting

1. **Confirm phase order** or reorder (e.g. "skip Phase 3 detail pages, I want tests first").
2. **License confirm**: MIT? Apache-2.0? Something else?
3. **Repo metadata**: project name as "CortexOS Dashboard"? Author / org name for `package.json` and LICENSE?
4. **Test scope**: are smoke tests per page enough, or do you want full interaction tests (click every button) on every page?

Reply with answers (or just "MIT, defaults, go") and I'll start Phase 1 in the next turn.