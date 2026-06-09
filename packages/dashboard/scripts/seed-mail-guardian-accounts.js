#!/usr/bin/env node
/**
 * One-shot seeder: imports MAIL_GUARDIAN_ACCOUNT_N_* env vars into
 * the mail_guardian_accounts table. Idempotent — uses ON CONFLICT (slug) DO NOTHING.
 *
 * Usage:
 *   node scripts/seed-mail-guardian-accounts.js
 *
 * Required env vars: DB_PASSWORD, MAIL_GUARDIAN_ACCOUNT_COUNT, MAIL_GUARDIAN_ACCOUNT_N_*
 * Optional env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER
 *
 * Source both secrets files before running:
 *   set -a
 *   source /opt/cortexos/.secrets/dashboard.env
 *   source /opt/cortexos/.secrets/mail-guardian.env
 *   set +a
 *   node packages/dashboard/scripts/seed-mail-guardian-accounts.js
 */

import { Client } from 'pg';

function readDbEnv() {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD environment variable is required');
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cortex_dashboard',
    user: process.env.DB_USER || 'dashboard',
    password: process.env.DB_PASSWORD,
  };
}

function readAccounts() {
  const rawCount = process.env.MAIL_GUARDIAN_ACCOUNT_COUNT;
  const count = rawCount ? parseInt(rawCount, 10) : 0;
  if (count < 1) {
    throw new Error(
      'MAIL_GUARDIAN_ACCOUNT_COUNT is missing or zero — nothing to seed',
    );
  }

  const accounts = [];
  for (let i = 1; i <= count; i++) {
    const get = (key) => {
      const val = process.env[`MAIL_GUARDIAN_ACCOUNT_${i}_${key}`];
      return val ?? null;
    };
    const slug = get('SLUG');
    const address = get('ADDRESS');
    const host = get('HOST');
    const portStr = get('PORT');
    const secureStr = get('SECURE');
    const username = get('USERNAME');
    const passwordB64 = get('PASSWORD_B64');
    const inbox = get('INBOX') ?? 'INBOX';
    const trashMailbox = get('TRASH_MAILBOX') ?? null;
    const reviewMailbox =
      get('REVIEW_MAILBOX') ?? 'INBOX.Cortex Mail Guardian Review';

    if (!slug || !address || !host || !portStr || !username || !passwordB64) {
      console.warn(
        `  [skip] account ${i} is missing required fields (slug/address/host/port/username/password_b64)`,
      );
      continue;
    }

    accounts.push({
      slug,
      address,
      host,
      port: parseInt(portStr, 10),
      secure: secureStr?.toLowerCase() !== 'false',
      username,
      passwordB64,
      inbox,
      trashMailbox,
      reviewMailbox,
      enabled: true,
    });
  }
  return accounts;
}

async function main() {
  const dbEnv = readDbEnv();
  const accounts = readAccounts();

  const client = new Client(dbEnv);
  await client.connect();

  try {
    let inserted = 0;
    let skipped = 0;

    for (const acc of accounts) {
      const result = await client.query(
        `INSERT INTO mail_guardian_accounts
           (slug, address, host, port, secure, username, password_b64,
            inbox, trash_mailbox, review_mailbox, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (slug) DO NOTHING`,
        [
          acc.slug,
          acc.address,
          acc.host,
          acc.port,
          acc.secure,
          acc.username,
          acc.passwordB64,
          acc.inbox,
          acc.trashMailbox,
          acc.reviewMailbox,
          acc.enabled,
        ],
      );
      if (result.rowCount > 0) {
        console.log(`  [inserted] ${acc.slug} <${acc.address}>`);
        inserted++;
      } else {
        console.log(`  [skipped]  ${acc.slug} (already exists)`);
        skipped++;
      }
    }

    console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);

    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM mail_guardian_accounts',
    );
    console.log(`Total rows in mail_guardian_accounts: ${rows[0].count}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
