import * as pg from "pg";
import type { Pool as PoolType, QueryResult } from "pg";

let cachedPool: PoolType | null = null;

type PgModuleShape = {
	Pool?: new (...args: any[]) => PoolType;
	default?: { Pool?: new (...args: any[]) => PoolType };
};

function getPoolCtor() {
	const mod = pg as unknown as PgModuleShape;
	const ctor = mod.Pool ?? mod.default?.Pool;
	if (!ctor) {
		throw new TypeError("pg.Pool constructor unavailable");
	}
	return ctor;
}

export function getPool() {
	if (!cachedPool) {
		if (!process.env.DB_PASSWORD) {
			throw new Error("DB_PASSWORD environment variable is required");
		}
		const PoolCtor = getPoolCtor();
		cachedPool = new PoolCtor({
			host: process.env.DB_HOST || "127.0.0.1",
			port: parseInt(process.env.DB_PORT || "5432", 10),
			database: process.env.DB_NAME || "cortex_dashboard",
			user: process.env.DB_USER || "dashboard",
			password: process.env.DB_PASSWORD,
			max: 20,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000,
		});
	}
	return cachedPool;
}

export const pool = getPool;

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
	const result = await getPool().query(text, params as any[] | undefined);
	return result.rows as T[];
}

export async function queryResult(text: string, params?: unknown[]): Promise<QueryResult> {
	return getPool().query(text, params as any[] | undefined);
}

export async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
	const rows = await query<T>(text, params);
	return rows[0] ?? null;
}

export async function execute(text: string, params?: unknown[]): Promise<void> {
	await queryResult(text, params);
}
