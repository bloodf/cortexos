// Test fixture for `local/require-admin-on-privileged-route` and
// `local/no-requireauth-in-admin`.
//
// This file lives in tests/, NOT in packages/dashboard/src/routes/admin/.
// To exercise the rules, copy it to that path before running lint —
// see tests/eslint-rules/RUN.md for the test harness.

import { json } from '@sveltejs/kit';
import { requireAdmin, requireAuth } from '$lib/server/auth';

const db = { query: () => {}, update: () => {}, delete: () => {} };

// VIOLATION: GET handler does not call requireAdmin first
export const GET = async () => {
  const rows = db.query('SELECT * FROM users');
  return json(rows);
};

// VIOLATION: POST handler uses requireAuth (should be requireAdmin)
export const POST = async () => {
  const session = await requireAuth();
  return json({ ok: true, user: session });
};

// OK: calls requireAdmin first
export const PUT = async () => {
  await requireAdmin();
  const result = db.update();
  return json(result);
};

// OK: const _guard = await requireAdmin(...)
export const DELETE = async ({ params }) => {
  const _guard = await requireAdmin({ scope: 'admin' });
  db.delete(params.id);
  return json({ ok: true });
};
