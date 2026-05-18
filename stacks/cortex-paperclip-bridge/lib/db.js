import pg from "pg";

let poolInstance = null;

export function getPool() {
  if (poolInstance) return poolInstance;
  const dsn = process.env.PG_DSN;
  if (!dsn) throw new Error("PG_DSN not configured");
  poolInstance = new pg.Pool({ connectionString: dsn, max: 8, idleTimeoutMillis: 30_000 });
  return poolInstance;
}

export async function closePool() {
  if (!poolInstance) return;
  await poolInstance.end();
  poolInstance = null;
}
