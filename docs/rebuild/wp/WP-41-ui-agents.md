# WP-41 — UI: Agents
- **Wave:** 2   **Depends-on:** WP-04, WP-21 (final wiring)   **Parallel-safe-with:** WP-30–WP-40
- **Owns (edit only these):**
  - `src/routes/_authenticated.agents.tsx`
  - `src/features/Agents.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Agents page (card grid with state/health indicators + inspect dialog showing agent profile files) to real data from `GET /api/agents`. Replace `api.agents` mock call with the WP-04 typed client. The file upload action for admin users calls `POST /api/agents/:slug/files` (multipart). Agent control actions (start/stop/pause/restart) are display-only unless WP-21 exposes control endpoints — show a real empty-state or informational toast if not available. The inspect dialog shows real profile file contents. Visual layout (card grid + inspect dialog) stays 1-1 with sys-pilot.

## Read first

- `src/features/Agents.tsx` — mock call site: `api.agents` (queryFn); `handleAction()` is a mock toast; `InspectorBody` renders file list + `CodeBlock` from `agent.files`
- `src/mocks/api.ts` — `api.agents`
- `01-API-CONTRACT.md` §Agents:
  - `GET /api/agents` (any) → `{agents:[]}` — Hermes profiles registry read
  - `POST /api/agents/:slug/files` (admin) multipart → `{ok}` — scoped file upload to profile dir
- `src/lib/api/` (WP-04) — typed client
- `src/lib/adapters/` (WP-04) — Hermes `Agent` profile type → component prop shape (`Agent`, `AgentHealth`, `AgentRunState`)
- `src/mocks/types.ts` — current `Agent` mock type for reference (fields: `name`, `slug`, `model`, `modelProvider`, `description`, `state`, `health`, `uptimeSec`, `queueDepth`, `requestsPerMin`, `errorRatePct`, `p95LatencyMs`, `version`, `lastActivity`, `hermesUrl`, `files`)
- Legacy reference: `packages/dashboard/src/routes/(authed)/agents/+page.server.ts`, `packages/dashboard/src/routes/(authed)/agents/+page.svelte`

## Steps

1. **Replace `api.agents` with real client.**
   - `queryFn: api.agents` → `queryFn: () => apiClient.agents.list()` then extract `data.agents`.
   - Query key stays `["agents"]`. Add `refetchInterval: 10000` (agent health updates periodically).
   - Adapt the Hermes profiles registry response to the component `Agent` shape using `src/lib/adapters/agents.ts`.
   - The Hermes profiles registry (`profiles.json`) contains profile metadata. The runtime fields (`state`, `health`, `uptimeSec`, `queueDepth`, `requestsPerMin`, `errorRatePct`, `p95LatencyMs`, `lastActivity`) may not all be present if Hermes does not expose live telemetry. Map what is available; for missing fields use sensible defaults (`state: "idle"`, `health: "healthy"`, numeric fields `0`) rather than fabricated values.

2. **Inspect dialog — real profile files.**
   - The `InspectorBody` component renders `agent.files` as a list with `CodeBlock`. The real Hermes profile dir contains files like `CLAUDE.md`, `settings.json`, `profile.json`. The `GET /api/agents` response must include file contents (or WP-21 must expose them). Wire file contents from the API response; if WP-21 does not return file contents in the list endpoint, render a real empty-state in the file list: "File contents not available via API."
   - Do NOT render fabricated file content strings.

3. **File upload action (admin).**
   - The current `handleAction()` is a mock toast for start/stop/pause/restart. For file upload specifically:
     - If the UI has a file upload button in the inspect dialog (check current `_authenticated.agents.tsx` and `Agents.tsx` JSX), wire it to `POST /api/agents/:slug/files` as a multipart `FormData` request with CSRF header.
     - On success, invalidate `["agents"]` and show `toast.success("File uploaded")`.
     - Gate on `user.is_admin`.
   - If no file upload UI element exists in sys-pilot, do not add one.

4. **Agent control actions (start/stop/pause/restart).**
   - `GET /api/agents` and `POST /api/agents/:slug/files` are the only two endpoints in the contract. There is no start/stop/restart/pause endpoint in `01-API-CONTRACT.md`.
   - Replace the `handleAction()` mock toast with an informative toast: `toast.info("Agent control requires Hermes API integration — not yet available.")` rather than pretending the action worked.
   - Keep all action buttons visible (they are part of sys-pilot's 1-1 UI) — just update the click handler to show the informative toast.
   - Do NOT remove the buttons or fabricate state changes.

5. **Search and filter.**
   - The client-side search (`q` state) and state filter (`stateFilter`) continue to work on the in-memory `agents` array from the query. No changes needed here beyond the data source swap.
   - The `counts` memo (all/running/idle/stopped/error) derives from `agents` array — will reflect real data automatically.

6. **Loading / empty states.**
   - While loading, the existing `<CardSkeleton>` grid renders (6 skeletons) — keep as-is.
   - If `agents` list is empty (no Hermes profiles registered): the existing `<EmptyState icon={<Bot>} title="No agents match" description="No Hermes agents are registered yet." />` already handles this — keep it.
   - If `GET /api/agents` returns an error: show `<EmptyState title="Could not load agents" description={error.message} />`.

## Acceptance criteria

- [ ] Agents grid renders real agents from `GET /api/agents` (Hermes profiles registry)
- [ ] Inspect dialog shows real profile file contents (or real empty-state if not available)
- [ ] File upload button (if present in UI) calls `POST /api/agents/:slug/files` multipart with CSRF
- [ ] Control action buttons show informative toast (not fake state changes)
- [ ] Search and state filter work on real data
- [ ] No fabricated agent runtime metrics (use defaults for unavailable fields, not random values)
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
curl http://localhost:3080/api/agents -b <session>
# Dev: /agents — verify real agent names/slugs appear from profiles.json
# Click "Inspect" on an agent — verify file list shows real files
# Click Restart on an agent — verify informative toast appears (not fake state change)
```

## Notes / gotchas

- `GET /api/agents` reads from the Hermes profiles registry (`profiles.json` in the Hermes config dir). If no agents are registered, the list will genuinely be empty — that is correct; do not fall back to mock seed data.
- The `hermesUrl` field in the mock type is a link to the agent's Hermes UI. This comes from the profile metadata. If not present in the real API response, set to `""` and disable the "Hermes UI" external link button (hide or render as disabled `<span>`).
- Runtime telemetry fields (`uptimeSec`, `queueDepth`, `requestsPerMin`, `errorRatePct`, `p95LatencyMs`, `lastActivity`) are only available if Hermes exposes a live status API. WP-21 reads profiles, not live Hermes metrics. Use `0` / `"idle"` / `"healthy"` defaults for missing fields. Do NOT generate random values.
- The `InspectorBody` file list uses `agent.files[0]?.path` to set the default selected file. If `agent.files` is empty, `activeFile` is undefined — guard `file` check before calling `CodeBlock` to avoid rendering with `undefined` content.
- Multipart file upload: use `FormData`, append the file, and include `x-csrf-token` header. Do not set `Content-Type` manually — the browser sets `multipart/form-data` with the correct boundary automatically.
