// Test fixture for `local/require-admin-on-privileged-route` and
// `local/no-requireauth-in-admin`.
//
// This file lives in tests/, NOT in packages/dashboard/src/routes/admin/.
// To exercise the rules, copy it to that path before running lint —
// see tests/eslint-rules/RUN.md for the test harness.

import { json, error } from '@sveltejs/kit';
import { requireAdmin, requireAuth } from '$lib/server/auth';

export const GET_VIOLATION = async () => {
  // VIOLATION: privileged handler does not call requireAdmin
  const rows = await db.query('SELECT * FROM users');
  return json(rows);
};

export const POST_VIOLATION = async () => {
  // VIOLATION: requires auth, not admin
  const session = await requireAuth();
  return json({ ok: true, user: session.user });
};

export const PUT_OK = async () => {
  // OK: calls requireAdmin first
  await requireAdmin();
  const result = await db.update(...);
  return json(result);
};

export const DELETE_OK = async ({ params }) => {
  // OK: const _guard = await requireAdmin(...)
  const _guard = await requireAdmin({ scope: 'admin' });
  await db.delete(params.id);
  return json({ ok: true });
};
