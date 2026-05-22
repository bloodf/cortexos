#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";

const listenHost = process.env.PAPERCLIP_PROXY_HOST || "127.0.0.1";
const listenPort = Number(process.env.PAPERCLIP_PROXY_PORT || 3033);
const upstreamHost = process.env.PAPERCLIP_UPSTREAM_HOST || "127.0.0.1";
const upstreamPort = Number(process.env.PAPERCLIP_UPSTREAM_PORT || 3034);
const nineRouterBase = (process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const nineRouterKey = process.env.NINEROUTER_API_KEY || "";

const hermesModelsPathRe = /^\/(?:api\/)?companies\/[^/]+\/adapters\/hermes_local\/models\/?$/;

function labelForModel(id) {
	return id
		.replace(/^[^/]+\//, "")
		.replace(/[-_:]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function loadNineRouterModels() {
	const res = await fetch(`${nineRouterBase}/v1/models`, {
		headers: {
			accept: "application/json",
			...(nineRouterKey ? { authorization: `Bearer ${nineRouterKey}` } : {}),
		},
	});
	if (!res.ok) throw new Error(`9Router models request failed: ${res.status}`);
	const body = await res.json();
	const data = Array.isArray(body?.data) ? body.data : [];
	return data
		.map((entry) => (typeof entry?.id === "string" ? entry.id.trim() : ""))
		.filter(Boolean)
		.map((id) => ({ id, label: labelForModel(id) }));
}

function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": Buffer.byteLength(payload),
		"cache-control": "no-store",
	});
	res.end(payload);
}

function proxyRequest(req, res) {
	const headers = { ...req.headers, host: `${upstreamHost}:${upstreamPort}` };
	const upstream = http.request(
		{
			host: upstreamHost,
			port: upstreamPort,
			method: req.method,
			path: req.url,
			headers,
		},
		(upstreamRes) => {
			res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
			upstreamRes.pipe(res);
		},
	);
	upstream.on("error", (error) => {
		writeJson(res, 502, { error: error.message || "Paperclip upstream unavailable" });
	});
	req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
	if (req.method === "GET" && hermesModelsPathRe.test(url.pathname)) {
		try {
			writeJson(res, 200, await loadNineRouterModels());
		} catch (error) {
			writeJson(res, 502, {
				error: error instanceof Error ? error.message : "Failed to load 9Router models",
			});
		}
		return;
	}
	proxyRequest(req, res);
});

if (process.env.LISTEN_FDS === "1") {
	server.listen({ fd: 3 }, () => {
		console.log("paperclip local proxy listening on systemd socket");
	});
} else {
	server.listen(listenPort, listenHost, () => {
		console.log(`paperclip local proxy listening on ${listenHost}:${listenPort}`);
	});
}
