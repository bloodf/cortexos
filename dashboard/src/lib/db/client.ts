import { Pool } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
	if (!pool) {
		if (!process.env.DB_PASSWORD) {
			throw new Error("DB_PASSWORD environment variable is required");
		}
		pool = new Pool({
			host: process.env.DB_HOST || "127.0.0.1",
			port: parseInt(process.env.DB_PORT || "5432", 10),
			database: process.env.DB_NAME || "cortex_dashboard",
			user: process.env.DB_USER || "dashboard",
			password: process.env.DB_PASSWORD,
		});
		pool.on("error", (error) => {
			console.error("[postgres-pool] unexpected idle client error", error);
		});
	}
	return pool;
}

export async function query<T = unknown>(
	text: string,
	params?: unknown[],
): Promise<T[]> {
	const client = await getPool().connect();
	try {
		const result = await client.query(text, params);
		return result.rows as T[];
	} finally {
		client.release();
	}
}

export async function queryOne<T = unknown>(
	text: string,
	params?: unknown[],
): Promise<T | null> {
	const rows = await query<T>(text, params);
	return rows[0] ?? null;
}

export async function execute(text: string, params?: unknown[]): Promise<void> {
	const client = await getPool().connect();
	try {
		await client.query(text, params);
	} finally {
		client.release();
	}
}

export { getPool as pool };
