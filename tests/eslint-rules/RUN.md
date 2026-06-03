# ESLint custom-rule test harness

This directory holds the fixtures used to exercise the three local rules
shipped under `packages/dashboard/eslint-rules/`.

## How the rules are wired

The three custom rules are referenced in the root `eslint.config.js`:

| Rule | ESLint name | Trigger files |
|---|---|---|
| `no-bash-c-in-template.js` | `local/no-bash-c-in-template` | `packages/dashboard/src/**/*.{svelte,ts}` |
| `require-admin-on-privileged-route.js` | `local/require-admin-on-privileged-route` | `+server.ts` files under `packages/dashboard/src/routes/admin/`, `src/routes/api/services/`, `src/routes/api/commands/`, `src/routes/api/audit/`, `src/routes/api/users/` |
| `no-requireauth-in-admin.js` | `local/no-requireauth-in-admin` | `packages/dashboard/src/routes/admin/**/*.{svelte,ts,js}` |

## Running the fixtures

The fixtures (`test-bash-c.svelte`, `test-priv-route.ts`) live at the
repo root in this directory. They are NOT inside the `files` globs that
trigger the rules — that means by default, ESLint will not even look at
them.

To exercise the rules, copy the fixtures into the trigger paths and
re-run lint:

```bash
# 1. Copy the bash-c fixture into the SvelteKit src tree
mkdir -p packages/dashboard/src/lib/components/__fixtures__
cp tests/eslint-rules/test-bash-c.svelte \
   packages/dashboard/src/lib/components/__fixtures__/

# 2. Copy the priv-route fixture into the admin route group
mkdir -p packages/dashboard/src/routes/admin/__fixtures__
cp tests/eslint-rules/test-priv-route.ts \
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
mavis-trash packages/dashboard/src/lib/components/__fixtures__
mavis-trash packages/dashboard/src/routes/admin/__fixtures__
```

## Why this layout

The fixtures are kept at the repo root so that:

1. They are stable across M1-WS2 (the SvelteKit app merge) — the rules
   survive even if `packages/dashboard/` is rebuilt.
2. They can be linted explicitly via a dedicated script (e.g.
   `pnpm test:lint-rules`) instead of cluttering CI output.
3. The trigger paths they copy to are exactly the production paths the
   rules guard in real code.

## Programmatic verification

For a one-shot check that the rules register and fire, use ESLint's
Node API:

```js
// scripts/verify-local-rules.js
import { Linter } from 'eslint';
import customRules from './packages/dashboard/eslint-rules/index.js';

const linter = new Linter();

const svelteFixture = `
<script>const x = 'bash -c "id"';</script>
<p>test</p>
`;

const messages = linter.verify(svelteFixture, [
  {
    files: ['**/*.svelte'],
    plugins: { local: { rules: customRules } },
    rules: { 'local/no-bash-c-in-template': 'error' },
  },
], { filename: 'fixture.svelte' });

console.log(messages);
// Expect: [{ ruleId: 'local/no-bash-c-in-template', severity: 2, ... }]
```
