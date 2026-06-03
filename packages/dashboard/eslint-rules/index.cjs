// CortexOS — local ESLint rules
//
// Three project-specific rules that codify security/correctness invariants
// we don't want to rely on humans to enforce:
//
//   1. `local/no-bash-c-in-template`
//        Bans `bash -c` in any string literal. `bash -c <user_input>` is
//        the classic shell-injection vector. We never need to spawn a
//        bash subshell from the SvelteKit app — the privileged surface
//        (m1-backend-skeleton / Mock API) uses an `approval token` flow
//        to authorize discrete commands. If you find yourself reaching
//        for `bash -c`, stop — that's the wrong primitive.
//
//   2. `local/require-admin-on-privileged-route`
//        Walks every `+server.ts` file under the listed privileged paths
//        (admin, /api/services, /api/commands, /api/audit, /api/users)
//        and asserts that the exported handlers call `requireAdmin(...)`
//        before doing anything privileged. Catches the case where someone
//        adds a new endpoint to the admin area but forgets the guard.
//
//   3. `local/no-requireauth-in-admin`
//        Inside `src/routes/admin/`, a request for `requireAuth(...)` is
//        a smell — admin routes need `requireAdmin(...)`, not just
//        authentication. This rule warns (the dev probably means to
//        upgrade the guard, not delete it).
//
// All three rules are written as plain JS objects (CommonJS-compatible),
// registered via the `meta` / `create` pattern that ESLint flat config
// expects.
//
// To add a new rule: drop a `my-rule.js` file in this directory, add
// it to `index.js` below, and reference it as `local/my-rule` in the
// root `eslint.config.js`.

'use strict';

const noBashCInTemplate = require('./no-bash-c-in-template.cjs');
const requireAdminOnPrivilegedRoute = require('./require-admin-on-privileged-route.cjs');
const noRequireauthInAdmin = require('./no-requireauth-in-admin.cjs');

module.exports = {
  'no-bash-c-in-template': noBashCInTemplate,
  'require-admin-on-privileged-route': requireAdminOnPrivilegedRoute,
  'no-requireauth-in-admin': noRequireauthInAdmin,
};
