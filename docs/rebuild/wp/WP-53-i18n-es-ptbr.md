# WP-53 — i18n es / pt-br
- **Wave:** 4   **Depends-on:** WP-52 (cutover complete)   **Parallel-safe-with:** WP-54
- **Owns (edit only these):**
  - `packages/dashboard-next/src/i18n/es.ts`
  - `packages/dashboard-next/src/i18n/ptBR.ts`
- **Do NOT touch:** `packages/dashboard-next/src/i18n/en.ts` (source-of-truth, read-only); `packages/dashboard-next/src/i18n/index.ts` (already wires all three locales); any component or route file; `packages/dashboard` (legacy)

## Objective

Port all user-visible strings from the legacy `es` and `pt-br` message files into
the dashboard-next TypeScript locale dictionaries so the language switcher
produces fully-translated UI in both languages. The `en.ts` dict is already
complete and typed; `es.ts` and `ptBR.ts` must be brought to parity with it.

## Read first

| File | Why |
|------|-----|
| `packages/dashboard-next/src/i18n/en.ts` | **Source of truth** — every key that must exist in es + ptBR |
| `packages/dashboard-next/src/i18n/es.ts` | Existing scaffold — may be empty or partial |
| `packages/dashboard-next/src/i18n/ptBR.ts` | Existing scaffold — may be empty or partial |
| `packages/dashboard-next/src/i18n/index.ts` | Framework wiring (`Dict` type, `getDict`, `LOCALES`) |
| `packages/dashboard/src/lib/i18n/messages/es.json` | **Legacy translations to port** — 1,145 lines, 16 top-level sections |
| `packages/dashboard/src/lib/i18n/messages/pt-br.json` | **Legacy translations to port** — 1,145 lines, 16 top-level sections |
| `packages/dashboard/src/lib/i18n/messages/en.json` | Legacy English — use to map legacy key → new key when in doubt |

## Key inventory

### Legacy top-level sections (16 keys in each JSON file)
`app`, `login`, `dashboard`, `errors`, `apps`, `services`, `docker`, `approvals`,
`systemd`, `alerts`, `audit` (+ additional sections — verify by running
`python3 -c "import json; print(list(json.load(open('packages/dashboard/src/lib/i18n/messages/en.json')).keys()))"`)

Total: ~735 unique translated strings per locale across all sections.

### Dashboard-next `en.ts` top-level keys (discovered)
`app`, `common`, `status`, `auth`, `nav`, `overview`, `services`, `docker`,
`incus`, `systemd`, `network`, `storage`, `processes`, `terminal`, `mailGuardian`,
`approvals`, `audit`, `alerts`, `admin`, `agents`, `errors`

### Mapping strategy
The new key structure in `en.ts` does not map 1-1 to the legacy JSON. Follow
this priority order when porting a string:

1. **Direct match:** same semantic meaning, same section. Copy the translation.
2. **Section rename:** e.g. legacy `login.*` → new `auth.*`; legacy `dashboard.*` → new `overview.*`. Map by meaning.
3. **New key in `en.ts` with no legacy equivalent:** translate from the English value in `en.ts` using the same register and tone as the surrounding legacy translations. Do not leave any key as the English fallback in production locales.
4. **Legacy key with no new equivalent:** discard (the string is no longer in the UI). Do not add extra keys not present in `en.ts` — the `Dict` type enforces the shape.

## Steps

1. Read `packages/dashboard-next/src/i18n/en.ts` in full to get the complete key tree and the `Dict` type definition.
2. Read `packages/dashboard/src/lib/i18n/messages/es.json` in full.
3. Read `packages/dashboard/src/lib/i18n/messages/pt-br.json` in full.
4. For `es.ts`: build the full object matching the `Dict` type exactly, filling every leaf string with the Spanish translation. Use legacy `es.json` as the primary source; translate from English for new keys.
5. For `ptBR.ts`: repeat with `pt-br.json` as the primary source.
6. Run TypeScript check to confirm both files satisfy the `Dict` type with zero errors:
   ```bash
   pnpm --filter @cortexos/dashboard-next typecheck
   ```
7. Run the dev server and toggle the language switcher to `es` and `pt-br`; spot-check at least 5 sections visually (nav, login, docker list, approvals, alerts).
8. Run the test suite to confirm no regressions:
   ```bash
   pnpm --filter @cortexos/dashboard-next test
   ```

## Structure reference (`en.ts` shape, partial)

```ts
export const en = {
  app:     { name, tagline },
  common:  { search, loading, empty, error, retry, cancel, confirm, save,
             delete, create, edit, close, open, refresh, admin, actions,
             status, name, type, description, enabled, disabled, yes, no,
             all, none, start, stop, restart, logs, remove, favorite },
  status:  { online, offline, unknown, checking },
  auth:    { signIn, username, password, show, hide, invalid, logout },
  nav:     { platform, infra, secOps, admin, overview, apps, healthcheck,
             agents, docker, incus, systemd, storage, network, processes,
             terminal, mailGuardian, approvals, audit, alerts, scheduler,
             backups },
  // ... (read en.ts for the complete tree)
}
export type Dict = typeof en;
```

`es.ts` and `ptBR.ts` must export objects whose type satisfies `Dict` exactly.
The `index.ts` already imports them: `const dicts: Record<Locale, Dict> = { en, es, "pt-br": ptBR }`.
TypeScript strict mode will flag any missing or extra key.

## Acceptance criteria

- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` exits 0 — both locale files satisfy `Dict` with no missing keys and no `any`.
- [ ] Every leaf string in `es.ts` is in Spanish; every leaf string in `ptBR.ts` is in Brazilian Portuguese. No English fallbacks in either file (except proper nouns: `CortexOS`, `Docker`, `Incus`, `PAM`, route names).
- [ ] Language switcher on the live site (`:3080`) toggles all visible strings — nav, login page, table headers, action buttons, error messages — correctly for both locales.
- [ ] `pnpm --filter @cortexos/dashboard-next test` exits 0.
- [ ] No edits outside OWNS.
- [ ] `STATUS.md` updated: `WP-53 done`.

## Verification commands

```bash
# Type check
pnpm --filter @cortexos/dashboard-next typecheck 2>&1 | grep -c error
# Expected: 0

# Test suite
pnpm --filter @cortexos/dashboard-next test --reporter=verbose 2>&1 | tail -10

# Key count sanity check — es and ptBR must have same leaf count as en
node -e "
const {en} = require('./packages/dashboard-next/src/i18n/en.ts');
const count = (o) => typeof o === 'string' ? 1 : Object.values(o).reduce((a,v)=>a+count(v),0);
console.log('en:', count(en));
" 2>/dev/null || echo "run from repo root with tsx if needed"
```

## Notes / gotchas

- `Dict` is `typeof en` — adding a key to `es` that does not exist in `en` is a TypeScript error. Only translate what `en.ts` defines.
- Legacy `pt-br.json` uses Brazilian Portuguese; the new file is `ptBR.ts` (camelCase filename, `"pt-br"` locale key in `index.ts`). The mapping is already set up in `index.ts`.
- Some legacy JSON keys use dot-notation nesting notation (e.g. `"docker.containers"`); the new structure uses nested objects. Unwrap accordingly.
- Preserve placeholder patterns if any exist in the source strings (e.g. `{count}`, `{name}`). Match whatever interpolation syntax `en.ts` uses (likely template literal `${...}` in function strings, or raw `{count}` for static strings — check `en.ts` for the pattern in use).
- Do not introduce a translation library (i18next, etc.) — the existing `getDict` pattern is intentionally minimal. Stay within it.
- If a legacy translation is machine-translated or nonsensical, use the English value from `en.ts` rather than propagating a bad translation.
