/**
 * Typed accessors for the `config` key/value table (created in 001_schema.sql).
 *
 * Values are stored as TEXT. Non-string values are JSON-encoded on write and
 * JSON-parsed on read; `getConfigValue` falls back to the provided default when
 * the key is missing or the stored value fails to parse as the expected shape.
 */
import { queryOne, execute } from "./client";

interface ConfigRow {
	value: string;
}

/**
 * Read a config key. Returns `fallback` if the key is absent. If `fallback` is
 * a string, the raw stored text is returned; otherwise the stored text is
 * JSON-parsed (returning `fallback` on parse failure).
 */
export async function getConfigValue<T>(key: string, fallback: T): Promise<T> {
	const row = await queryOne<ConfigRow>(
		"SELECT value FROM config WHERE key = $1",
		[key],
	);
	if (!row) return fallback;
	if (typeof fallback === "string") {
		return row.value as unknown as T;
	}
	try {
		return JSON.parse(row.value) as T;
	} catch {
		return fallback;
	}
}

/** Upsert a config key. String values are stored verbatim; others JSON-encoded. */
export async function setConfigValue(key: string, value: unknown): Promise<void> {
	const text = typeof value === "string" ? value : JSON.stringify(value);
	await execute(
		`INSERT INTO config (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
		[key, text],
	);
}
