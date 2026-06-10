# WP-34 — UI: Incus + Wizard
- **Wave:** 2   **Depends-on:** WP-04, WP-12 (final wiring)   **Parallel-safe-with:** WP-30–WP-33, WP-35–WP-41
- **Owns (edit only these):**
  - `src/routes/_authenticated.incus.tsx`
  - `src/routes/_authenticated.incus.$name.tsx`
  - `src/features/Incus.tsx`
- **Do NOT touch:** `src/app/` shell, `src/mocks/` seed, `src/lib/api/` internals, any other route or feature file

## Objective

Wire the Incus list page (DataTable of instances + detail Sheet) and the provision wizard to real data from `GET /api/incus/instances`. Replace all `api.incus` / `api.incusList` mock calls with the WP-04 typed client. Instance actions (start, stop, restart, exec-named) call `POST /api/incus/actions` and `POST /api/incus/:name/exec-named` with CSRF + approval for destructive ops. The wizard `ProvisionWizard` calls real actions and streams log output. The instance detail route (`$name`) wires to real instance data and logs. Visual layout stays 1-1.

## Read first

- `src/features/Incus.tsx` — all mock call sites: `api.incus` (simple fetch), `api.incusList` (DataTable server prop); `ProvisionWizard` currently fakes provisioning with `setTimeout` and fabricated instance objects
- `src/routes/_authenticated.incus.$name.tsx` — instance detail route (read current content)
- `src/mocks/api.ts` — `api.incus`, `api.incusList`
- `01-API-CONTRACT.md` §Incus:
  - `GET /api/incus/instances → {items: IncusInstance[]}`
  - `POST /api/incus/actions → {result}` (admin; destructive→approval) `{action, name, ...}`
  - `POST /api/incus/:name/exec-named → {argv, status, output}` (admin) `{op, args}` allowlisted
  - `GET /api/incus/:name/logs → {lines:[]}` (any; query: tail)
- `src/lib/api/` (WP-04) — typed client
- `src/lib/adapters/` (WP-04) — `IncusInstance` from `@cortexos/contracts` → component shape
- Legacy reference: `packages/dashboard/src/routes/(authed)/incus/+page.server.ts`, `packages/dashboard/src/routes/(authed)/incus/[name]/+page.server.ts`, `packages/dashboard/src/routes/(authed)/incus/wizard/+page.server.ts`

## Steps

1. **Replace list queries with real client.**
   - `api.incus` → `apiClient.incus.instances()` returning `data.items`.
   - DataTable `server` prop: `api.incusList` → a client function that calls `GET /api/incus/instances` and wraps the result in `ListResult<IncusInstance>` format (client-side pagination/search if the endpoint returns all; server-side if WP-12 adds pagination params).
   - Adapt `IncusInstance` from contracts to component prop shape via `src/lib/adapters/incus.ts`. The mock type has `status: "active"|"provisioning"|"validated"|"draft"|"failed"` — map from the real contracts `IncusInstance` status field.

2. **Wire instance actions in list + detail.**
   - In the row action button (currently `onClick={() => setActive(r)}`), keep the Sheet open behavior.
   - Add action buttons to the Sheet detail panel (or the `$name` detail route): start, stop, restart → `POST /api/incus/actions {action, name}` + CSRF.
   - Destructive actions (delete) → approval token flow same as WP-33 docker pattern.
   - After action success, invalidate `["incus"]` query key.

3. **Wire `exec-named` / logs in detail Sheet.**
   - Replace any mock log/exec content in the Sheet or `$name` detail route with:
     - `GET /api/incus/:name/logs?tail=80` → `{lines:[]}` for the log view.
     - `POST /api/incus/:name/exec-named {op, args}` for allowed named operations (e.g. `update`, `validate`). Results in `{argv, status, output}` — display `output` in the existing `<CodeBlock>` or log panel.
   - If no logs endpoint is yet available (WP-12 pending), render real empty-state.

4. **Replace `ProvisionWizard` mock provisioning.**
   - The wizard currently uses `setTimeout` + fabricated `IncusInstance` objects. Replace `start()`:
     a. Step 0–3: collect name, image, cpu, mem (keep form UI 1-1).
     b. Step 4 (provisioning log): call `POST /api/incus/actions {action: "launch", name, image, cpu, memory}` with CSRF. Stream the `output` field from the response into the log lines display. On error show the API envelope `message`.
     c. On success, call `GET /api/incus/instances` (invalidate `["incus"]`) and close the wizard.
   - Do NOT inject a fabricated `IncusInstance` object via `onCreated`; let the real query refresh handle it.
   - Keep the step-by-step wizard UI and the terminal-style log pane 1-1.

5. **Instance detail route (`_authenticated.incus.$name.tsx`).**
   - Load `GET /api/incus/instances` and find by name, or use a single-instance endpoint if WP-12 exposes one.
   - Display `KeyValueList`, `CodeBlock` config/devices as before — wire from real `IncusInstance` shape.
   - Wire logs tab to `GET /api/incus/:name/logs`.

6. **Loading / empty states.**
   - While loading, DataTable skeleton already in place. Empty instances → `<EmptyState>` with "No Incus instances found."

## Acceptance criteria

- [ ] Incus list DataTable renders real instances from `GET /api/incus/instances`
- [ ] Instance detail Sheet shows real config, devices, logs
- [ ] Actions (start/stop/restart) call `POST /api/incus/actions` with CSRF; query invalidated
- [ ] Wizard calls real API (not setTimeout), logs stream from response, query refreshes on success
- [ ] No fabricated `IncusInstance` objects injected via `onCreated`
- [ ] Visual appearance unchanged vs sys-pilot
- [ ] Build and typecheck pass

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next build
curl http://localhost:3080/api/incus/instances -b <session>
curl http://localhost:3080/api/incus/<name>/logs?tail=50 -b <session>
curl -X POST http://localhost:3080/api/incus/actions \
  -H "Content-Type: application/json" -H "x-csrf-token: <csrf>" \
  -d '{"action":"stop","name":"<instance>"}' -b <session>
```

## Notes / gotchas

- The wizard's `ProvisionWizard` is in `src/features/Incus.tsx` (not a separate file). Edit only that component's `start()` function; leave the step/form JSX unchanged.
- `POST /api/incus/actions` action values are allowlisted in `server/incus/bridge.ts` (legacy policy). Valid values include at minimum: `start`, `stop`, `restart`, `delete`. The `launch` action may or may not be in the allowlist — check WP-12 output before wiring the wizard. If `launch` is not a bridge action, the wizard may need to call a separate provisioning endpoint — consult WP-12 contract.
- Approval tokens are required for destructive actions (`delete`). See `02-CONVENTIONS.md` §Approvals for the mint→grant→consume flow.
- `IncusInstance` status enum in contracts may differ from the mock's `"active"|"provisioning"|"validated"|"draft"|"failed"` — use the adapter to normalize.
- The `$name` detail route currently receives `params.name` from the router — use that as the instance name in all API calls.
