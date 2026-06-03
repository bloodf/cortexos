// Rule: local/no-requireauth-in-admin
//
// Inside `src/routes/admin/`, a call to `requireAuth(...)` is almost
// always wrong. Admin routes need `requireAdmin(...)` — the difference
// matters: `requireAuth` only checks that the caller is logged in;
// `requireAdmin` also checks the caller's group membership against
// `cortexos-admin` or `sudo` (see THREAT_MODEL.md SR-001).
//
// This rule fires as a warning (not an error) because there are
// legitimate edge cases: a public sub-page under /admin that exposes
// read-only data, or a deliberate "logged-in but not admin" UI. The
// warning forces the author to look at the call and either upgrade
// to requireAdmin or add an explicit disable comment.
//
// Severity: warn (not error). The author can disable per-line with
// `// eslint-disable-next-line local/no-requireauth-in-admin`.

'use strict';

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Admin routes should use requireAdmin, not requireAuth.',
    },
    schema: [],
    messages: {
      useRequireAdmin:
        '`requireAuth` in an admin route is suspicious. Use `requireAdmin` instead — requireAuth only checks login, requireAdmin also checks `cortexos-admin`/`sudo` group membership (THREAT_MODEL.md SR-001).',
    },
  },
  create(context) {
    function isRequireAuthCall(node) {
      if (node.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (!callee) return false;
      if (callee.type === 'Identifier' && callee.name === 'requireAuth') return true;
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'requireAuth'
      ) {
        return true;
      }
      return false;
    }

    return {
      CallExpression(node) {
        if (!isRequireAuthCall(node)) return;
        context.report({ node, messageId: 'useRequireAdmin' });
      },
    };
  },
};
