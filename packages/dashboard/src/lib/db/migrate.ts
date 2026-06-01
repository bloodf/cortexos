import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import os from "os";
import { query, execute } from "./client";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

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
		if (s.startsWith("wl") || s.startsWith("wlan")) return 2;
		if (s.startsWith("tailscale")) return 4;
		return 3;
	};

	candidates.sort((a, b) => score(a.source) - score(b.source));
	return candidates[0]?.ip;
}

export function replaceVpsLanIp(sql: string, ip: string): string {
	return sql.replace(/<VPS_LAN_IP>/g, ip);
}

interface Migration {
	name: string;
}

export async function runMigrations(): Promise<string[]> {
	// Ensure migrations table exists
	await execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

	const applied = await query<Migration>(
		"SELECT name FROM migrations ORDER BY name",
	);
	const appliedSet = new Set(applied.map((m) => m.name));

	const SAFE_FILENAME_RE = /^[a-zA-Z0-9_-]+\.sql$/;

	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith(".sql") && SAFE_FILENAME_RE.test(f))
		.sort();

	const run: string[] = [];

	for (const file of files) {
		const name = file.replace(".sql", "");
		if (appliedSet.has(name)) continue;

		const filePath = join(MIGRATIONS_DIR, file);
		if (!filePath.startsWith(MIGRATIONS_DIR)) continue;

		const sql = readFileSync(filePath, "utf-8");
		const lanIp = getLanIp();
		const finalSql = lanIp ? replaceVpsLanIp(sql, lanIp) : sql;
		await execute(finalSql);
		await execute("INSERT INTO migrations (name) VALUES ($1)", [name]);
		run.push(name);
	}

	return run;
}
