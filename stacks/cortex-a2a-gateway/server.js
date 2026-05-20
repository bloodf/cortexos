#!/usr/bin/env node
import http from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const HOST = process.env.A2A_HOST || "0.0.0.0";
const PORT = Number(process.env.A2A_PORT || 18802);
const TOKEN = process.env.A2A_GATEWAY_TOKEN || "";
const ALLOW_ANONYMOUS = process.env.A2A_ALLOW_ANONYMOUS === "1";
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || "openclaw";
const PUBLIC_URL = process.env.A2A_PUBLIC_URL || `http://127.0.0.1:${PORT}/a2a/jsonrpc`;

if (!TOKEN && !ALLOW_ANONYMOUS) {
  console.error("A2A_GATEWAY_TOKEN is required. Set A2A_ALLOW_ANONYMOUS=1 only for isolated local development.");
  process.exit(1);
}

const AGENTS = {
  "netbook-pm": "Netbook PM",
  "netbook-author": "Netbook Book Author",
  "netbook-editor": "Netbook Book Editor",
  "netbook-reviewer": "Netbook Book Reviewer",
  "netbook-evaluator": "Netbook Book Evaluator",
  "netbook-translator": "Netbook Book Translator",
  cieucpb: "CIEUCPB",
};

function agentCard() {
  return {
    name: "CortexOS A2A Gateway",
    description: "A2A bridge for CortexOS OpenClaw agents, including restored Netbook and CIEUCPB agents",
    url: PUBLIC_URL,
    version: "0.1.0",
    capabilities: { streaming: false, pushNotifications: false },
    skills: [
      { id: "chat", name: "chat", description: "Bridge chat/messages to OpenClaw agents" },
      { id: "netbook", name: "netbook", description: "Network Engineering Book production workflow agents" },
      { id: "cieucpb", name: "cieucpb", description: "CIEUCPB knowledge and operations agent" },
    ],
    cortexAgents: AGENTS,
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function authorized(req) {
  if (!TOKEN) return ALLOW_ANONYMOUS;
  const header = req.headers.authorization || "";
  return header === `Bearer ${TOKEN}`;
}

function textFromMessage(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.text === "string") return value.text;
  const parts = value.parts || value.message?.parts || value.params?.message?.parts || [];
  if (Array.isArray(parts)) {
    return parts.map((part) => part.text || part.content || "").filter(Boolean).join("\n");
  }
  return JSON.stringify(value);
}

function agentFromPayload(payload) {
  const explicit = payload?.agentId || payload?.message?.agentId || payload?.params?.agentId || payload?.params?.message?.agentId;
  if (explicit && AGENTS[explicit]) return explicit;
  const text = textFromMessage(payload?.params?.message || payload?.message || payload).toLowerCase();
  if (/cieucpb|umbanda|orixa|orix[aá]/.test(text)) return "cieucpb";
  if (/author|draft|escrever|rascunho/.test(text)) return "netbook-author";
  if (/review|revis[aã]o|avaliar/.test(text)) return "netbook-reviewer";
  if (/score|rubric|rubrica|evaluate/.test(text)) return "netbook-evaluator";
  if (/translate|traduz/.test(text)) return "netbook-translator";
  if (/pm|plan|planej/.test(text)) return "netbook-pm";
  return "netbook-editor";
}

function runOpenClaw(agentId, message) {
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_BIN, ["agent", "--agent", agentId, "--message", message, "--json", "--timeout", "900"], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `openclaw exited ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function parseOpenClawOutput(output) {
  if (!output) return "";
  try {
    const parsed = JSON.parse(output);
    const payloads = parsed?.result?.payloads;
    if (Array.isArray(payloads)) {
      const text = payloads
        .map((payload) => payload?.text)
        .filter((value) => typeof value === "string" && value.trim() && !value.startsWith("Cannot read properties of null"))
        .join("\n")
        .trim();
      if (text) return text;
    }
    const finalText = parsed?.result?.meta?.finalAssistantVisibleText
      || parsed?.result?.meta?.finalAssistantRawText
      || parsed?.finalAssistantVisibleText
      || parsed?.finalAssistantRawText;
    if (typeof finalText === "string" && finalText.trim()) return finalText.trim();
    if (typeof parsed?.summary === "string" && parsed.summary.trim()) return parsed.summary.trim();
  } catch {
    return output.trim();
  }
  return "completed";
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/.well-known/agent-card.json" || req.url === "/.well-known/agent.json")) {
      sendJson(res, 200, agentCard());
      return;
    }
    if (req.method === "GET" && req.url === "/healthz") {
      sendJson(res, 200, { status: "ok", agents: Object.keys(AGENTS) });
      return;
    }
    if (req.method !== "POST" || (req.url !== "/a2a/jsonrpc" && req.url !== "/a2a/rest")) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    if (!authorized(req)) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }
    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    const agentId = agentFromPayload(payload);
    const message = textFromMessage(payload.params?.message || payload.message || payload);
    if (!message.trim()) {
      sendJson(res, 400, { error: "message required" });
      return;
    }
    const output = parseOpenClawOutput(await runOpenClaw(agentId, message));
    const result = {
      id: payload.id || randomUUID(),
      agentId,
      status: { state: "completed" },
      message: {
        role: "agent",
        parts: [{ kind: "text", text: output }],
      },
    };
    if (req.url === "/a2a/jsonrpc") {
      sendJson(res, 200, { jsonrpc: "2.0", id: payload.id || null, result });
    } else {
      sendJson(res, 200, result);
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`cortex-a2a-gateway listening on ${HOST}:${PORT}\n`);
});
