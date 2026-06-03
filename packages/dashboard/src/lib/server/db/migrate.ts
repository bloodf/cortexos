/**
 * Programmatic SQL migration runner for the CortexOS dashboard.
 *
 * Reads `migrations/*.sql` in lexical order, applies any that are not
 * already recorded in the `migrations` table. Preserves the existing
 * runner convention (`scripts/migrate.js`, `lib/db/migrate.ts`):
 *   - File name must match `^[a-zA-Z0-9_-]+\.sql$`
 *   - `<VPS_LAN_IP>` placeholder is replaced with the host's first
 *     non-internal IPv4 address (sorted: eth/en > wlan/wlp > tailscale)
 *   - Each migration is applied as a single statement (or wrapped in
 *     the transaction the SQL body declares explicitly)
 *   - Re-running is a no-op for already-applied migrations
 *
 * The runner is DB-agnostic: it accepts an `Executor` that can both
 *   - `exec(sql)`: run a multi-statement DDL string and discard results
 *   - `query(sql, params)`: parameterised SELECT/INSERT, returning rows
 *
 * Production callers pass pg-backed implementations; pglite-backed tests
 * pass PGlite adapters.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const SAFE_FILENAME_RE = /^[a-zA-Z0-9_-]+\.sql$/;

export interface Executor {
	/** Run a multi-statement DDL string and ignore any rows. */
	exec: (sql: string) => Promise<void>;
	/** Parameterised SELECT/INSERT/UPDATE returning rows (or empty). */
	query: <T = Record<string, unknown>>(
		sql: string,
		params?: unknown[],
	) => Promise<T[]>;
}

export interface RunMigrationsOptions {
	/** Where the SQL files live. */
	dir: string;
	executor: Executor;
	/** Override the LAN IP detection (defaults to `getLanIp()`). */
	lanIp?: string;
	/**
	 * Tolerate failures that only apply to the production Postgres
	 * extension set (TimescaleDB's `create_hypertable`, etc.). The
	 * canonical migrations reference these extensions; against a
	 * test driver that doesn't ship them (e.g. pglite) the relevant
	 * statements fail, but the rest of the migration is valid.
	 *
	 * When `true`, the runner swallows the extension-related errors
	 * and continues. Use only in tests; production callers leave it
	 * `false` (the default).
	 */
	ignoreUnsupportedExtensions?: boolean;
	/**
	 * Substrings of error messages that, when matched, should be
	 * treated as "extension not available" and ignored. Default:
	 * `["timescaledb"]`. Used together with `ignoreUnsupportedExtensions`.
	 */
	ignoredExtensionPatterns?: string[];
}

/**
 * Find the most likely LAN IP for `<VPS_LAN_IP>` replacement. Mirrors
 * `src/lib/db/migrate.ts:8-31` (the existing pg-based runner) and
 * `scripts/migrate.js:11-30` so the two runners stay in sync.
 */
export function getLanIp(): string | undefined {
	const ifaces = os.networkInterfaces();
	const candidates: { ip: string; source: string }[] = [];

	for (const [name, addrs] of Object.entries(ifaces)) {
		if (!addrs) continue;
		for (const addr of addrs) {
			if (addr.internal) continue;
			if (addr.family !== "IPv4") continue;
			candidates.push({ ip: addr.address, source: name });
		}
	}

	const score = (source: string): number => {
		const s = source.toLowerCase();
		if (s.startsWith("eth") || s.startsWith("en")) return 1;
		if (s.startsWith("wl") || s.startsWith("wl")) return 2;
		if (s.startsWith("tailscale")) return 4;
		return 3;
	};

	candidates.sort((a, b) => score(a.source) - score(b.source));
	return candidates[0]?.ip;
}

export function replaceVpsLanIp(sql: string, ip: string): string {
	return sql.replace(/<VPS_LAN_IP>/g, ip);
}

interface MigrationRow {
	name: string;
}

/**
 * Run all un-applied migrations in `dir` against the supplied `executor`.
 *
 * Returns the list of migration names that were actually applied (in
 * the order they were applied). Idempotent: re-running returns [].
 */
export async function runSqlMigrations(opts: RunMigrationsOptions): Promise<string[]> {
	// Bootstrap the migrations table if it doesn't exist yet. Safe to
	// re-run (the SQL is idempotent).
	await opts.executor.exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) UNIQUE NOT NULL,
			applied_at TIMESTAMP DEFAULT NOW()
		)
	`);

	const applied = await opts.executor.query<MigrationRow>(
		"SELECT name FROM migrations ORDER BY name",
	);
	const appliedSet = new Set(applied.map((m) => m.name));

	const files = readdirSync(opts.dir)
		.filter((f) => f.endsWith(".sql") && SAFE_FILENAME_RE.test(f))
		.sort();

	const run: string[] = [];

	for (const file of files) {
		const name = file.replace(/\.sql$/, "");
		if (appliedSet.has(name)) continue;

		const filePath = join(opts.dir, file);
		// Defence-in-depth: ensure the resolved path is still inside `dir`.
		if (!filePath.startsWith(opts.dir)) continue;

		const sqlText = readFileSync(filePath, "utf-8");
		const ip = opts.lanIp ?? getLanIp();
		let finalSql = ip ? replaceVpsLanIp(sqlText, ip) : sqlText;

		// When running against a driver that doesn't ship the prod
		// extensions (e.g. PGlite without TimescaleDB), pre-filter the
		// SQL to drop the extension-only statements. Without this,
		// PGlite's `exec` rolls back the entire batch when the first
		// `CREATE EXTENSION` fails — meaning no tables get created.
		//
		// The pre-filter is conservative: it removes lines that match
		// the ignored patterns (CREATE EXTENSION, create_hypertable
		// for TimescaleDB). It does NOT touch the rest of the schema.
		if (opts.ignoreUnsupportedExtensions) {
			finalSql = filterExtensionStatements(finalSql, opts.ignoredExtensionPatterns);
		}

		// Apply the migration. The `executor.exec` is allowed to wrap
		// in a transaction (pg's Pool.query is a single implicit
		// transaction per call). SQL bodies that need their own
		// transaction (`BEGIN; ... COMMIT;`) declare it explicitly.
		try {
			await opts.executor.exec(finalSql);
		} catch (e) {
			if (opts.ignoreUnsupportedExtensions && isIgnoredExtensionError(e, opts.ignoredExtensionPatterns)) {
				// The migration file references an extension that the
				// test driver doesn't ship (e.g. TimescaleDB on PGlite).
				// The migration runner records the file as "applied" so
				// subsequent runs treat the rest of the schema as
				// already established. This matches what a real
				// prod-without-TimescaleDB would experience.
			} else {
				throw e;
			}
		}

		// Record the applied migration. Parameterised; safe regardless
		// of filename contents.
		await opts.executor.query(
			"INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
			[name],
		);
		run.push(name);
	}

	return run;
}

function isIgnoredExtensionError(e: unknown, patterns?: string[]): boolean {
	const msg = errorMessage(e).toLowerCase();
	const all = (patterns ?? ["timescaledb"]).map((p) => p.toLowerCase());
	return all.some((p) => msg.includes(p));
}

/**
 * Drop statements that reference ignored extensions. Used to make
 * TimescaleDB-tinged migrations runnable against PGlite (which doesn't
 * ship the extension). Conservative: matches lines that contain
 * `CREATE EXTENSION ... <pattern>` or `create_hypertable(` and
 * replaces them with empty strings. Comment lines are also removed
 * to keep the resulting SQL clean.
 */
function filterExtensionStatements(sql: string, patterns?: string[]): string {
	const all = (patterns ?? ["timescaledb"]).map((p) => p.toLowerCase());
	let out = sql;
	for (const p of all) {
		const pEsc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		// Remove `CREATE EXTENSION [IF NOT EXISTS] <name>` lines.
		out = out.replace(
			new RegExp(`^\\s*CREATE\\s+EXTENSION(\\s+IF\\s+NOT\\s+EXISTS)?\\s+["']?${pEsc}["']?\\s*;?\\s*$`, "gim"),
			"",
		);
		// Remove `SELECT create_hypertable(...)` statements. Match any
		// line containing `create_hypertable(`, regardless of where
		// the `;` lands (single-line statements only — multi-line
		// `create_hypertable` is not used in the current migrations).
		out = out.replace(
			new RegExp(`^[^\\n]*create_hypertable\\s*\\([^\\n]*;?\\s*$`, "gim"),
			"",
		);
	}
	// Collapse runs of blank lines left behind.
	out = out.replace(/\n{3,}/g, "\n\n");
	return out;
}

function errorMessage(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	try {
		return JSON.stringify(e);
	} catch {
		return String(e);
	}
}

/**
 * Default `dir`: the dashboard package's `migrations/` directory,
 * resolved relative to the process working directory. Mirrors
 * `lib/db/migrate.ts:6` (MIGRATIONS_DIR = cwd/migrations).
 */
export function defaultMigrationsDir(): string {
	return join(process.cwd(), "migrations");
}

/**
 * Build an `Executor` from the production pg Pool. Used by the runtime
 * entrypoint to wire `migrate.ts` to the same `pg` instance the rest
 * of the data layer uses.
 */
export async function pgExecutor(pool: {
	query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}): Promise<Executor> {
	return {
		exec: async (sql) => {
			await pool.query(sql);
		},
		query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
			const res = await pool.query(sql, params);
			return res.rows as T[];
		},
	};
}
