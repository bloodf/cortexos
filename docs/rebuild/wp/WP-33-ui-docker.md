# WP-33 — UI: Docker
- **Wave:** 2   **Depends-on:** WP-04, WP-11 (final wiring)   **Parallel-safe-with:** WP-30–WP-32, WP-34–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.docker.tsx`
  - `src/routes/_authenticated.docker.$id.tsx`
  - `src/features/Docker.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Docker page (containers / images / volumes tabs) and the container detail route to real data from `GET /api/docker/containers|images|volumes`. Replace all `api.docker.*` mock calls with the WP-04 typed client. Container actions (start, stop, restart, remove) call `POST /api/docker/actions` with CSRF header and approval flow for destructive ops. Log drawer calls the real container logs endpoint. Visual layout stays 1-1.

## Read first

- `src/features/Docker.tsx` — all mock call sites: `api.docker.containers`, `api.docker.images`, `api.docker.volumes`, `api.docker.containersList`, `api.docker.imagesList`, `api.docker.volumesList`; action handlers use `qc.setQueryData` mocks
- `src/routes/_authenticated.docker.$id.tsx` — container detail route (read current content)
- `src/mocks/api.ts` — `api.docker.*` functions
- `01-API-CONTRACT.md` §Docker: `GET /api/docker/containers|images|volumes → {items:[...]}`; `POST /api/docker/actions → {result}` (admin; destructive → approval token)
- `src/lib/api/` (WP-04) — typed client; note CSRF injection + approval-token header pattern
- `src/lib/adapters/` (WP-04) — Docker entity adapters (`DockerContainer`, `DockerImage`, `DockerVolume` from contracts → component shapes)
- Legacy reference: `packages/dashboard/src/routes/(authed)/docker/+page.server.ts`, `packages/dashboard/src/routes/(authed)/docker/[id]/+page.server.ts`
- Legacy action allowlist: `packages/dashboard/src/lib/server/docker/real-data.ts` (allowed actions: `start`, `stop`, `restart`, `rm`)

## Steps

1. **Replace list queries with real client.**
   - `api.docker.containers` → `apiClient.docker.containers()` returning `data.items`.
   - `api.docker.images` → `apiClient.docker.images()` returning `data.items`.
   - `api.docker.volumes` → `apiClient.docker.volumes()` returning `data.items`.
   - For the paginated DataTable `server` prop: replace `api.docker.containersList`, `api.docker.imagesList`, `api.docker.volumesList` with client functions that call `GET /api/docker/containers|images|volumes` and wrap results into `ListResult<T>` format (client-side slice if the endpoint returns all items; or coordinate with WP-11 for server-side pagination if implemented).

2. **Wire container actions.**
   - Start: `POST /api/docker/actions` with `{action: "start", container: id}` + CSRF header.
   - Stop: `POST /api/docker/actions` with `{action: "stop", container: id}` + CSRF header.
   - Restart: `POST /api/docker/actions` with `{action: "restart", container: id}` + CSRF header.
   - Remove (`rm`): destructive — requires an approval token. Flow:
     a. User clicks remove → open `<ConfirmDialog>` (already present).
     b. On confirm, call `POST /api/approvals` to mint a token for `action: "docker.rm"`.
     c. Wait for admin to grant via `/approvals` page OR use auto-grant if the current user is admin (check WP-16 / `02-CONVENTIONS.md` §Approvals for the correct flow).
     d. Call `POST /api/docker/actions` with the `x-cortex-approval-token` header.
   - After each successful action, invalidate `["docker","containers"]` query key.
   - Show `toast.error(envelope.message)` on API errors (including 412 approval_required).

3. **Wire log drawer.**
   - The `<DetailDrawer>` currently shows `<MockLogs>`. Replace with a real log fetch: `GET /api/docker/containers` does not stream logs — check if WP-11 exposes a logs endpoint (the legacy has `docker/[id]/logs/+server.ts`). If available, use `apiClient.docker.logs(containerId, { tail: 120 })` and display lines in the existing `LogViewer` or `LogStream` component. If WP-11 does not expose logs, render a real empty-state ("Logs not available") rather than mock lines.
   - Remove `<MockMetrics>` and `<MockEnv>` tabs entirely or replace with real empty-states — do not render fabricated data.

4. **Container detail route (`_authenticated.docker.$id.tsx`).**
   - Fetch the specific container: `GET /api/docker/containers` then find by id, or if WP-11 exposes `GET /api/docker/containers/:id`, use that.
   - Keep any existing detail layout 1-1; wire the same action buttons as in step 2.

5. **Loading / empty states.**
   - While loading tabs, show the existing tab skeleton. Empty containers/images/volumes → `<EmptyState>` with appropriate message.

## Acceptance criteria

- [ ] Containers tab lists real containers from `GET /api/docker/containers`
- [ ] Images tab lists real images (deduped, `<none>` tags filtered — server does this; confirm output is clean)
- [ ] Volumes tab lists real volumes
- [ ] Start/stop/restart actions call `POST /api/docker/actions` with CSRF; query invalidated on success
- [ ] Remove action requires and uses an approval token (412 handled gracefully)
- [ ] No `<MockLogs>`, `<MockMetrics>`, `<MockEnv>` render in production
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
curl http://localhost:3080/api/docker/containers -b <session>
curl http://localhost:3080/api/docker/images -b <session>
curl -X POST http://localhost:3080/api/docker/actions \
  -H "Content-Type: application/json" -H "x-csrf-token: <csrf>" \
  -d '{"action":"restart","container":"<id>"}' -b <session>
```

## Notes / gotchas

- Images: the backend (`server/docker/real-data.ts`) deduplicates and drops `<none>` tags server-side. The frontend does not need extra filtering.
- The legacy `DOCKER_ACTION_ALLOWLIST` covers `start|stop|restart|rm|pull`. The `POST /api/docker/actions` endpoint enforces this allowlist; the frontend only needs to pass the action name.
- `rm` is the only action requiring an approval token in the contract. `pull` may also require one — check `01-API-CONTRACT.md` note on "destructive→approval".
- The `<ConfirmDialog>` with `requireText={r.name}` is already wired in the UI. Keep it — just replace the `onConfirm` body with the real API call + approval flow.
- `DockerContainer` type in mocks has `id`, `name`, `image`, `state`, `status`, `ports`. The contracts type may differ slightly — use the adapter layer, do not reshape the component columns.
