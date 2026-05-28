import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const MIGRATIONS_DIR = resolve(__dirname, "../../..", "migrations");

function readMigration(name: string): string {
	return readFileSync(resolve(MIGRATIONS_DIR, name), "utf8");
}

const RETIRED_SLUGS = [
	"paperclip",
	"nats",
	"nats-monitor",
	"openviking",
	"leann",
	"openclaw",
	"cortex-consumer",
	"cortex-graph",
	"floci",
	"langfuse",
	"opik",
];

describe("002_seed.sql integrity", () => {
	const seed = readMigration("002_seed.sql");

	// Extract only INSERT INTO services lines (not badge inserts or other tables)
	// by isolating the VALUES block of the services INSERT
	const servicesInsertMatch = seed.match(
		/INSERT INTO services[\s\S]+?ON CONFLICT \(slug\) DO UPDATE/,
	);
	const servicesInsertBlock = servicesInsertMatch ? servicesInsertMatch[0] : "";

	it("contains no retired slug in services INSERT", () => {
		for (const slug of RETIRED_SLUGS) {
			// Match slug as a quoted value in the INSERT block
			const pattern = new RegExp(`'${slug}'`);
			expect(
				pattern.test(servicesInsertBlock),
				`Retired slug '${slug}' found in 002_seed.sql services INSERT`,
			).toBe(false);
		}
	});

	it("cadvisor and mongo-express do not share a health port", () => {
		// Extract health_url values for cadvisor and mongo-express from INSERT rows
		const cadvisorMatch = seed.match(
			/\('cadvisor'[^)]*'(http:\/\/127\.0\.0\.1:\d+[^']*)'[^)]*\)/,
		);
		const mongoExpressMatch = seed.match(
			/\('mongo-express'[^)]*'(http:\/\/127\.0\.0\.1:\d+[^']*)'[^)]*\)/,
		);

		expect(cadvisorMatch, "cadvisor row not found in seed").toBeTruthy();
		expect(
			mongoExpressMatch,
			"mongo-express row not found in seed",
		).toBeTruthy();

		const cadvisorUrl = cadvisorMatch![1];
		const mongoExpressUrl = mongoExpressMatch![1];

		const extractPort = (url: string): string => {
			const m = url.match(/:(\d+)/);
			return m ? m[1] : "";
		};

		const cadvisorPort = extractPort(cadvisorUrl);
		const mongoExpressPort = extractPort(mongoExpressUrl);

		expect(cadvisorPort).not.toBe("");
		expect(mongoExpressPort).not.toBe("");
		expect(
			cadvisorPort,
			`cadvisor (port ${cadvisorPort}) and mongo-express (port ${mongoExpressPort}) share a health port`,
		).not.toBe(mongoExpressPort);
	});
});
