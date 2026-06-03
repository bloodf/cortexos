import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
import { join } from 'path';

const client = new PGlite();
const sql = readFileSync(join(process.cwd(), 'migrations/001_schema.sql'), 'utf-8');
try {
  await client.exec(sql);
  console.log('001 OK');
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tables after 001:', tables.rows.map(r => r.table_name).sort());
} catch (e) {
  console.log('001 failed:', e.message);
  const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log('Tables after 001 (partial):', tables.rows.map(r => r.table_name).sort());
}
await client.close();
