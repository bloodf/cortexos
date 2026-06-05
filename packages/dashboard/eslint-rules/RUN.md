# ESLint custom-rule test harness

Fixtures and a programmatic verifier for the three local rules in this
directory.

## How the rules are wired

The three custom rules are referenced in the root `eslint.config.js`:

| Rule | ESLint name | Trigger files |
|---|---|---|
| `no-bash-c-in-template.js` | `local/no-bash-c-in-template` | `packages/dashboard/src/**/*.{svelte,ts}` |
| `require-admin-on-privileged-route.js` | `local/require-admin-on-privileged-route` | `+server.ts` files under `packages/dashboard/src/routes/admin/`, `src/routes/api/services/`, `src/routes/api/commands/`, `src/routes/api/audit/`, `src/routes/api/users/` |
| `no-requireauth-in-admin.js` | `local/no-requireauth-in-admin` | `packages/dashboard/src/routes/admin/**/*.{svelte,ts,js}` |

## Running the fixtures

The fixtures (`fixtures/test-bash-c.svelte`, `fixtures/test-priv-route.ts`)
live here. They are NOT inside the `files` globs that trigger the rules —
ESLint will not look at them in place.

To exercise the rules, copy the fixtures into the trigger paths and
re-run lint:

```bash
# 1. Copy the bash-c fixture into the SvelteKit src tree
mkdir -p packages/dashboard/src/lib/components/__fixtures__
cp packages/dashboard/eslint-rules/fixtures/test-bash-c.svelte \
   packages/dashboard/src/lib/components/__fixtures__/

# 2. Copy the priv-route fixture into the admin route group
mkdir -p packages/dashboard/src/routes/admin/__fixtures__
cp packages/dashboard/eslint-rules/fixtures/test-priv-route.ts \
   packages/dashboard/src/routes/admin/__fixtures__/+server.ts

# 3. Lint
pnpm lint

# 4. Confirm the violations are flagged:
#    local/no-bash-c-in-template: bash -c found
#    local/require-admin-on-privileged-route: GET_VIOLATION missing guard
#    local/no-requireauth-in-admin: POST_VIOLATION uses requireAuth

# 5. Fix the fixtures (remove bash -c, add requireAdmin, replace
#    requireAuth with requireAdmin) and re-run lint — should be clean.

# 6. Clean up the fixture files in the SvelteKit src tree
rm -rf packages/dashboard/src/lib/components/__fixtures__
rm -rf packages/dashboard/src/routes/admin/__fixtures__
```

## Programmatic verification

One-shot check that the rules register and fire:

```bash
pnpm test:lint-rules
```
