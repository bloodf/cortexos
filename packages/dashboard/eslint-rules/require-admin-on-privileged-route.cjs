// Rule: local/require-admin-on-privileged-route
//
// Walks every +server.ts file under a privileged path and asserts that
// at least one exported request handler (GET, POST, PUT, DELETE,
// PATCH, OPTIONS, HEAD) calls `requireAdmin(...)` before any other
// statement in the handler body.
//
// Privileged paths (configured in eslint.config.js):
//   - src/routes/admin/**
//   - src/routes/api/services/**
//   - src/routes/api/commands/**
//   - src/routes/api/audit/**
//   - src/routes/api/users/**
//
// The rule is structural: it parses the file and looks at each
// exported async function named GET/POST/... If the first non-import,
// non-type-only statement in the body is NOT a call to requireAdmin,
// the rule fires.
//
// We deliberately do NOT use `await` as a structural signal — handlers
// may do other awaits (DB pool init, etc.) before reaching the
// requireAdmin check. We want the check to be the FIRST thing.

'use strict';

const PRIVILEGED_HANDLERS = new Set([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
]);

function isRequireAdminCall(node) {
  if (node.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (!callee) return false;
  if (callee.type === 'Identifier' && callee.name === 'requireAdmin') return true;
  // requireAdmin.default(...) pattern
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'requireAdmin'
  ) {
    return true;
  }
  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Privileged +server.ts handlers must call requireAdmin() before doing anything.',
    },
    schema: [],
    messages: {
      missingGuard:
        'Privileged handler {{name}} must call `requireAdmin(...)` as the first statement. See THREAT_MODEL.md SR-013 / SR-017.',
    },
  },
  create(context) {
    // Walk top-level exported async function declarations and
    // exported const handlers = async (...) => {} patterns.
    return {
      ExportNamedDeclaration(node) {
        const decl = node.declaration;
        if (!decl) return;

        // function GET/POST/...() { ... }
        if (decl.type === 'FunctionDeclaration' && decl.id && PRIVILEGED_HANDLERS.has(decl.id.name)) {
          checkHandler(context, decl, decl.id.name);
          return;
        }

        // const GET = async () => { ... }
        if (decl.type === 'VariableDeclaration') {
          for (const declarator of decl.declarations) {
            if (
              declarator.id.type === 'Identifier' &&
              PRIVILEGED_HANDLERS.has(declarator.id.name) &&
              declarator.init &&
              (declarator.init.type === 'ArrowFunctionExpression' ||
                declarator.init.type === 'FunctionExpression')
            ) {
              checkHandler(context, declarator.init, declarator.id.name);
            }
          }
        }
      },
    };
  },
};

function checkHandler(context, fnNode, name) {
  if (!fnNode.body || fnNode.body.type !== 'BlockStatement') return;
  // Find the first non-import, non-type, non-declaration statement.
  // We only look at statements that are "real work" — VariableDeclaration
  // (not import/typedef), ExpressionStatement, IfStatement, ReturnStatement.
  for (const stmt of fnNode.body.body) {
    // Skip type-only or const-without-init declarations
    if (stmt.type === 'VariableDeclaration') {
      // If it's a const X = await requireAdmin(...) — that's a guard.
      if (stmt.declarations.length === 1) {
        const decl = stmt.declarations[0];
        if (decl.init && isRequireAdminCall(decl.init)) {
          return; // OK
        }
        // Also accept: const _guard = await requireAdmin(...)
        if (decl.init && decl.init.type === 'AwaitExpression' && isRequireAdminCall(decl.init.argument)) {
          return; // OK
        }
      }
      // If it's an arrow-function decl with no body side-effects, skip
      if (stmt.declarations.every((d) => !d.init)) continue;
      // Otherwise this is "real work" — a guard is missing
      context.report({ node: fnNode, messageId: 'missingGuard', data: { name } });
      return;
    }
    if (stmt.type === 'ExpressionStatement') {
      if (isRequireAdminCall(stmt.expression)) return; // OK
      if (stmt.expression.type === 'AwaitExpression' && isRequireAdminCall(stmt.expression.argument)) {
        return; // OK
      }
      // Anything else is "real work" without a guard
      context.report({ node: fnNode, messageId: 'missingGuard', data: { name } });
      return;
    }
    // Return/If/For/Try/Block/Throw — real work
    context.report({ node: fnNode, messageId: 'missingGuard', data: { name } });
    return;
  }
  // Empty body — still report, the handler should at least call requireAdmin
  context.report({ node: fnNode, messageId: 'missingGuard', data: { name } });
}
