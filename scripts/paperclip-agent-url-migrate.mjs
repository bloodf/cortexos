#!/usr/bin/env node
/**
 * paperclip-agent-url-migrate
 *
 * Admin auto-migration companion to paperclip-agent-url-invariant.mjs.
 *
 * For every active agent across every company (or a restricted set), patches
 * `adapterConfig.paperclipApiUrl` to the current Paperclip server bind
 * (instances/default/config.json -> server.port). Uses merge semantics
 * (PATCH /api/agents/:id with adapterConfig.paperclipApiUrl ONLY), never
 * replaces the full adapterConfig.
 *
 * Acceptance: GUN-188 bullet 3 (optional bonus).
 *
 * Usage:
 *   node paperclip-agent-url-migrate.mjs --dry-run            # report only
 *   node paperclip-agent-url-migrate.mjs                       # perform PATCH
 *   PAPERCLIP_COMPANY_IDS=<uuid>,<uuid> node ...               # scope to companies
 *   PAPERCLIP_TARGET_URL=http://127.0.0.1:3034 node ...        # override target
 *
 * Exit codes:
 *   0 success (or dry-run with no required changes / dry-run reported plan)
 *   1 unexpected error
 *   2 partial failure (some PATCHes failed)
 */
import fs from "node:fs";

const CONFIG_PATH = process.env.PAPERCLIP_CONFIG || "/opt/cortexos/paperclip/instances/default/config.json";
const TOKEN = process.env.PAPERCLIP_API_KEY || "";
const RUN_ID = process.env.PAPERCLIP_RUN_ID || "agent-url-migrate";
const DRY_RUN = process.argv.includes("--dry-run") || process.env.PAPERCLIP_MIGRATE_DRY_RUN === "1";

if (!TOKEN) {
	console.error("missing PAPERCLIP_API_KEY");
	process.exit(1);
}

let cfg;
try {
	cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
} catch (err) {
	console.error(`cannot read ${CONFIG_PATH}: ${err.message}`);
	process.exit(1);
}
const serverHost = cfg?.server?.host || "127.0.0.1";
const serverPort = Number(cfg?.server?.port);
if (!serverPort) {
	console.error("config.json missing server.port");
	process.exit(1);
}

const SERVER_BASE = `http://127.0.0.1:${serverPort}`;
const TARGET_URL = process.env.PAPERCLIP_TARGET_URL || `http://${serverHost}:${serverPort}`;

function headers(extra = {}) {
	return {
		Authorization: `Bearer ${TOKEN}`,
		"X-Paperclip-Run-Id": RUN_ID,
		Accept: "application/json",
		...extra,
	};
}

async function getJson(url) {
	const res = await fetch(url, { headers: headers() });
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
	return res.json();
}

async function patchAgent(agentId, paperclipApiUrl) {
	const res = await fetch(`${SERVER_BASE}/api/agents/${agentId}`, {
		method: "PATCH",
		headers: headers({ "Content-Type": "application/json" }),
		body: JSON.stringify({ adapterConfig: { paperclipApiUrl } }),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`PATCH ${agentId} -> ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
	}
	return res.json();
}

async function main() {
	const companies = await getJson(`${SERVER_BASE}/api/companies`);
	const ids = (process.env.PAPERCLIP_COMPANY_IDS || companies.map((c) => c.id).join(","))
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);

	const plan = [];
	let totalAgents = 0;
	let alreadyOk = 0;

	for (const cid of ids) {
		let agents;
		try {
			agents = await getJson(`${SERVER_BASE}/api/companies/${cid}/agents`);
		} catch (err) {
			console.error(`[${cid}] failed to list agents: ${err.message}`);
			continue;
		}
		for (const a of agents) {
			totalAgents++;
			const current = a?.adapterConfig?.paperclipApiUrl;
			if (current === TARGET_URL) {
				alreadyOk++;
				continue;
			}
			plan.push({ companyId: cid, agentId: a.id, name: a.nameKey, from: current ?? null, to: TARGET_URL });
		}
	}

	const summary = {
		dryRun: DRY_RUN,
		serverBase: SERVER_BASE,
		targetUrl: TARGET_URL,
		companies: ids.length,
		totalAgents,
		alreadyOk,
		toPatchCount: plan.length,
		plan,
	};

	if (DRY_RUN || plan.length === 0) {
		console.log(JSON.stringify(summary, null, 2));
		process.exit(0);
	}

	const results = [];
	let failures = 0;
	for (const step of plan) {
		try {
			await patchAgent(step.agentId, step.to);
			results.push({ ...step, ok: true });
		} catch (err) {
			failures++;
			results.push({ ...step, ok: false, error: err.message });
		}
	}

	console.log(
		JSON.stringify(
			{
				...summary,
				patched: results.filter((r) => r.ok).length,
				failed: failures,
				results,
			},
			null,
			2,
		),
	);

	process.exit(failures > 0 ? 2 : 0);
}

main().catch((err) => {
	console.error(err?.stack || err?.message || String(err));
	process.exit(1);
});
