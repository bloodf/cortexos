#!/usr/bin/env node
/**
 * paperclip-agent-url-invariant
 *
 * Verifies that every active agent's `adapterConfig.paperclipApiUrl` points at
 * a reachable URL whose underlying host:port matches the current Paperclip
 * server bind (instances/default/config.json server.port) OR the documented
 * local compatibility proxy. Surfaces drift instead of letting agents fail
 * with process_lost / Connection refused at heartbeat time.
 *
 * Exit codes:
 *   0  all good (no drift, every URL reachable)
 *   2  drift detected (some agents reference a port that is not the current
 *      server bind or the proxy port)
 *   3  unreachable URL detected
 *   1  unexpected error
 *
 * Invoke from cron / systemd timer / dashboard health endpoint.
 *
 * Env:
 *   PAPERCLIP_API_KEY   (required)   bearer token
 *   PAPERCLIP_CONFIG    optional     path to instances config.json
 *                                     (default: /opt/cortexos/paperclip/instances/default/config.json)
 *   PAPERCLIP_PROXY_PORT optional    compatibility proxy port (default 3033)
 *   PAPERCLIP_COMPANY_IDS optional   comma-separated; default = all companies
 */
import fs from "node:fs";
import http from "node:http";

const CONFIG_PATH = process.env.PAPERCLIP_CONFIG || "/opt/cortexos/paperclip/instances/default/config.json";
const PROXY_PORT = Number(process.env.PAPERCLIP_PROXY_PORT || 3033);
const TOKEN = process.env.PAPERCLIP_API_KEY || "";
const RUN_ID = process.env.PAPERCLIP_RUN_ID || "agent-url-invariant";

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
const serverPort = Number(cfg?.server?.port);
if (!serverPort) {
	console.error("config.json missing server.port");
	process.exit(1);
}

const SERVER_BASE = `http://127.0.0.1:${serverPort}`;
const ACCEPTED_PORTS = new Set([serverPort, PROXY_PORT]);

function headers() {
	return {
		Authorization: `Bearer ${TOKEN}`,
		"X-Paperclip-Run-Id": RUN_ID,
		Accept: "application/json",
	};
}

async function getJson(url) {
	const res = await fetch(url, { headers: headers() });
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
	return res.json();
}

async function reachable(url) {
	return new Promise((resolve) => {
		try {
			const u = new URL(url);
			const req = http.request(
				{
					host: u.hostname,
					port: u.port || 80,
					method: "GET",
					path: "/api/health",
					timeout: 1500,
				},
				(res) => {
					res.resume();
					resolve(res.statusCode != null && res.statusCode < 500);
				},
			);
			req.on("error", () => resolve(false));
			req.on("timeout", () => {
				req.destroy();
				resolve(false);
			});
			req.end();
		} catch {
			resolve(false);
		}
	});
}

async function main() {
	const companies = await getJson(`${SERVER_BASE}/api/companies`);
	const ids = (process.env.PAPERCLIP_COMPANY_IDS || companies.map((c) => c.id).join(","))
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);

	const drift = [];
	const unreachable = [];
	let total = 0;

	for (const cid of ids) {
		let agents;
		try {
			agents = await getJson(`${SERVER_BASE}/api/companies/${cid}/agents`);
		} catch (err) {
			console.error(`[${cid}] failed to list agents: ${err.message}`);
			continue;
		}
		for (const a of agents) {
			total++;
			const url = a?.adapterConfig?.paperclipApiUrl;
			if (!url) {
				drift.push({ companyId: cid, agentId: a.id, name: a.nameKey, reason: "missing paperclipApiUrl" });
				continue;
			}
			let port;
			try {
				port = Number(new URL(url).port || 80);
			} catch {
				drift.push({ companyId: cid, agentId: a.id, name: a.nameKey, url, reason: "unparseable URL" });
				continue;
			}
			if (!ACCEPTED_PORTS.has(port)) {
				drift.push({
					companyId: cid,
					agentId: a.id,
					name: a.nameKey,
					url,
					reason: `port ${port} not in {${[...ACCEPTED_PORTS].join(",")}}`,
				});
				continue;
			}
			if (!(await reachable(url))) {
				unreachable.push({ companyId: cid, agentId: a.id, name: a.nameKey, url });
			}
		}
	}

	const report = {
		serverPort,
		proxyPort: PROXY_PORT,
		acceptedPorts: [...ACCEPTED_PORTS],
		totalAgents: total,
		driftCount: drift.length,
		unreachableCount: unreachable.length,
		drift,
		unreachable,
	};
	console.log(JSON.stringify(report, null, 2));

	if (drift.length > 0) process.exit(2);
	if (unreachable.length > 0) process.exit(3);
	process.exit(0);
}

main().catch((err) => {
	console.error(err?.stack || err?.message || String(err));
	process.exit(1);
});
