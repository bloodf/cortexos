/**
 * cortex-agent-generator — WS sidecar (P3.1 + P3.2 + P3.3 infra).
 *
 * Binds 127.0.0.1:3082. Reuses the root PTY pattern from cortex-terminal: the
 * connected admin gets a real root bash via node-pty. The same WS also carries
 * AI generator frames (chat deltas, advisor/skeptic panels, build triggers)
 * alongside PTY bytes, so the UI can drive the conversation AND the shell
 * from a single connection.
 *
 * Auth mirrors terminal (cortex-session-auth): Origin check → session cookie →
 * admin re-derived live from OS group + role freshness. The generator session
 * ID is propagated in the `user` frame; advisor/skeptic models run on a
 * background turn schedule.
 *
 * Frame protocol (server → client):
 *   {type:'chat', role, delta}
 *   {type:'advisor', model, delta}
 *   {type:'skeptic', model, delta}
 *   {type:'pty', data}         — raw PTY bytes (incl. WhatsApp QR)
 *   {type:'spec', spec}
 *   {type:'status', status}
 *   {type:'exit', code}
 * Client → server:
 *   {type:'user', text, attachments}
 *   {type:'input', data}       — manual PTY input
 *   {type:'resize', cols, rows}
 *   {type:'build', spec}
 */

import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import pty from "node-pty";
import { Pool } from "pg";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import {
  configureDbPool,
  parseCookies,
  checkOrigin,
  validateSession,
  clientIp,
  DEFAULT_ROLE_CHECK_MAX_AGE_MS,
  SESSION_COOKIE_NAME,
  ADMIN_GROUP,
} from "@cortexos/session-auth";

const PORT = Number(process.env.GENERATOR_PORT || 3082);
const HOST = "127.0.0.1";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const ROLE_CHECK_MAX_AGE_MS = Number(
  process.env.GENERATOR_ROLE_CHECK_MAX_AGE_MS || DEFAULT_ROLE_CHECK_MAX_AGE_MS,
);
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const NINEROUTER_ENV = "/opt/cortexos/.secrets/9router.env";

let _pool = null;
export function setPoolForTests(pool) {
  _pool = pool;
  if (pool) configureDbPool(pool);
}
function pool() {
  if (_pool) return _pool;
  const p = new Pool({ connectionString: process.env.DATABASE_URL });
  _pool = p;
  configureDbPool(p);
  return p;
}

function readEnv(path, key) {
  try {
    const txt = fs.readFileSync(path, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(new RegExp(`^${key}=(.*)$`));
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
  return "";
}

function nineRouterBase() {
  const raw = readEnv(NINEROUTER_ENV, "NINEROUTER_BASE_URL");
  return (raw || "http://127.0.0.1:11434").replace(/\/+$/, "") + "/v1";
}
function nineRouterKey() {
  return readEnv(NINEROUTER_ENV, "NINEROUTER_API_KEY");
}

function openaiClient() {
  const key = nineRouterKey();
  if (!key) throw new Error("NINEROUTER_API_KEY missing");
  return createOpenAI({ baseURL: nineRouterBase(), apiKey: key });
}

const ADVISOR_DEFAULT = "cc/claude-opus-4-8";
const SKEPTIC_DEFAULT = "cx/gpt-5.5";

const httpServer = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok\n");
    return;
  }
  res.writeHead(426);
  res.end("Upgrade required\n");
});

const wss = new WebSocketServer({ noServer: true });

function abortHandshake(socket, status) {
  const text =
    { 401: "Unauthorized", 403: "Forbidden", 500: "Internal Server Error" }[status] || "Error";
  try {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  } catch {}
}

function acceptThenClose(req, socket, head, code, reason, ip) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    try { ws.close(code, reason); } catch { try { ws.terminate(); } catch {} }
    console.log(JSON.stringify({ event: "ws_close", code, reason, ip, ts: Date.now() }));
  });
}

httpServer.on("upgrade", async (req, socket, head) => {
  const ip = clientIp(req.headers);
  if (!checkOrigin(req.headers.origin, req.headers.host, ALLOWED_ORIGIN)) {
    console.log(JSON.stringify({ event: "rejected_origin", ip, ts: Date.now() }));
    abortHandshake(socket, 403);
    return;
  }
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    acceptThenClose(req, socket, head, 401, "unauthorized", ip);
    return;
  }
  const grant = await validateSession(token, {
    now: () => Date.now(),
    maxRoleAgeMs: ROLE_CHECK_MAX_AGE_MS,
  });
  if (!grant) {
    acceptThenClose(req, socket, head, 401, "unauthorized", ip);
    return;
  }
  if (!grant.isAdmin) {
    acceptThenClose(req, socket, head, 4403, "forbidden", ip);
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws, grant.username, ip));
});

/**
 * Convert raw inbound attachments into the `ai` SDK content shape.
 * Images (mime starts with `image/`) become multimodal parts; everything
 * else (pdf/text/etc.) collapses into a text manifest line. Invalid entries
 * are silently dropped — the user gets a manifest that explains what was
 * actually sent rather than an opaque 4xx that would kill the WS.
 *
 * Caps are mirrored from the dashboard RPC schema; defense-in-depth only.
 */
const MAX_ATTACHMENT_COUNT = 8;
const MAX_ATTACHMENT_B64 = 35_000_000;

export function buildUserContent(text, attachments) {
  const cleanText = typeof text === "string" ? text : "";
  const parts = [{ type: "text", text: cleanText }];
  const manifest = [];
  const atts = Array.isArray(attachments) ? attachments : [];
  for (let i = 0; i < atts.length && i < MAX_ATTACHMENT_COUNT; i += 1) {
    const a = atts[i];
    if (!a || typeof a !== "object") continue;
    const filename = typeof a.filename === "string" ? a.filename : `attachment-${i + 1}`;
    const mime = typeof a.mime === "string" ? a.mime : "";
    const data = typeof a.dataBase64 === "string" ? a.dataBase64 : "";
    if (!data) continue;
    if (data.length > MAX_ATTACHMENT_B64) {
      manifest.push(`- ${filename}: skipped (exceeds 35M base64 chars / ~25MB decoded cap)`);
      continue;
    }
    if (mime.startsWith("image/")) {
      parts.push({ type: "image", image: `data:${mime};base64,${data}` });
      manifest.push(`- ${filename} (${mime}, image)`);
    } else {
      manifest.push(`- ${filename} (${mime || "unknown"}, non-image; metadata only)`);
    }
  }
  const userContent = parts.length === 1 ? cleanText : parts;
  const fullText = manifest.length === 0
    ? cleanText
    : `${cleanText}\n\nAttached files:\n${manifest.join("\n")}`;
  return { userContent, fullText };
}

function send(ws, frame) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(frame));
}

const SYSTEM_PROMPT =
  "You are the CortexOS Agent Generator. Interview the operator to design a Hermes agent profile, then emit a complete JSON spec in a fenced ```json block.";

function handleConnection(ws, username, ip) {
  console.log(JSON.stringify({ event: "ws_open", user: username, ip, ts: Date.now() }));
  const state = { sessionId: null, model: ADVISOR_DEFAULT, pty: null };
  let idleTimer = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      try { ws.close(4408, "idle timeout"); } catch { try { ws.terminate(); } catch {} }
    }, IDLE_TIMEOUT_MS);
  };
  resetIdle();

  let p = null;
  try {
    p = pty.spawn("/bin/bash", [], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: "/opt/cortexos",
      env: { ...process.env, TERM: "xterm-256color" },
    });
    state.pty = p;
    p.onData((d) => send(ws, { type: "pty", data: d }));
    p.onExit(({ exitCode }) => {
      send(ws, { type: "exit", code: exitCode });
      try { ws.close(); } catch {}
    });
  } catch (err) {
    send(ws, { type: "status", status: "pty_failed", detail: err instanceof Error ? err.message : String(err) });
  }

  ws.on("message", async (raw) => {
    resetIdle();
    let frame;
    try { frame = JSON.parse(raw.toString()); } catch { return; }
    switch (frame.type) {
      case "input":
        if (p) p.write(typeof frame.data === "string" ? frame.data : "");
        break;
      case "resize":
        if (typeof frame.cols === "number" && typeof frame.rows === "number") {
          try { p && p.resize(frame.cols, frame.rows); } catch {}
        }
        break;
      case "user": {
        const text = typeof frame.text === "string" ? frame.text : "";
        const model = typeof frame.model === "string" && frame.model.length > 0 ? frame.model : state.model;
        if (!text) break;
        const { userContent } = buildUserContent(text, frame.attachments);
        send(ws, { type: "status", status: "thinking" });
        const openai = openaiClient();
        try {
          const main = await streamText({
            model: openai(model),
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
            providerOptions: { openai: { reasoningEffort: "medium" } },
            abortSignal: AbortSignal.timeout(120000),
          });
          for await (const delta of main.textStream) {
            send(ws, { type: "chat", role: "assistant", delta });
          }
          send(ws, { type: "status", status: "idle" });
        } catch (err) {
          send(ws, { type: "status", status: "error", detail: err instanceof Error ? err.message : String(err) });
        }
        // Advisor/skeptic panels are meta-panels; they get a text manifest
        // instead of full image parts.
        const { fullText } = buildUserContent(text, frame.attachments);
        runPanel(openai, ADVISOR_DEFAULT, "advisor", fullText, (f) => send(ws, f));
        runPanel(openai, SKEPTIC_DEFAULT, "skeptic", fullText, (f) => send(ws, f));
        break;
      }
      case "build":
        send(ws, { type: "status", status: "build_started" });
        break;
      default:
        break;
    }
  });

  ws.on("close", () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (state.pty) {
      try { state.pty.kill(); } catch {}
    }
    console.log(JSON.stringify({ event: "ws_close_user", user: username, ip, ts: Date.now() }));
  });
}

async function runPanel(openai, model, role, userText, emit) {
  const system = role === "advisor"
    ? "You are the ADVISOR panel. Suggest improvements to the emerging agent profile. Be concise (2-3 sentences)."
    : "You are the SKEPTIC panel. Find gaps, risks, and missing permissions in the plan. Be concise (2-3 sentences).";
  try {
    const result = await streamText({
      model: openai(model),
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText },
      ],
      abortSignal: AbortSignal.timeout(60000),
    });
    for await (const delta of result.textStream) {
      emit({ type: role, model, delta });
    }
  } catch {
    // Panel failures are advisory only; never block the main model.
  }
}

const isMain = process.argv[1]
  ? fileURLToPath(import.meta.url) === process.argv[1]
  : false;

if (isMain) {
  httpServer.listen(PORT, HOST, () => {
    console.log(JSON.stringify({
      event: "listen", host: HOST, port: PORT,
      adminGroup: ADMIN_GROUP, allowedOrigin: ALLOWED_ORIGIN,
      ts: Date.now(),
    }));
  });
}

export { httpServer, wss, handleConnection, send, acceptThenClose, abortHandshake, runPanel };
