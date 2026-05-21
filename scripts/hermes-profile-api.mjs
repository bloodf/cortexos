#!/usr/bin/env node
import http from "node:http";
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";

const profile = process.env.HERMES_PROFILE || process.argv[2] || "default";
const host = process.env.HERMES_API_HOST || "127.0.0.1";
const port = Number(process.env.HERMES_API_PORT || 18691);
const model = process.env.HERMES_MODEL || "cx/gpt-5.5";
const reasoning = process.env.HERMES_REASONING || "medium";
const hermesCommand = process.env.HERMES_COMMAND || "hermes";
const hermesHome = process.env.HERMES_HOME || `/opt/cortexos/hermes/profiles/${profile}`;
const apiKey = process.env.HERMES_API_KEY || "";
const defaultArgs = (process.env.HERMES_CHAT_ARGS || "chat -q").split(/\s+/).filter(Boolean);
const maxBuffer = Number(process.env.HERMES_API_MAX_BUFFER || 1024 * 1024 * 8);
const timeout = Number(process.env.HERMES_API_TIMEOUT_MS || 300000);

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function requireAuth(req, res) {
  if (!apiKey) return true;
  const header = req.headers.authorization || "";
  if (header === `Bearer ${apiKey}`) return true;
  send(res, 401, { error: "unauthorized" });
  return false;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function messagePrompt(messages) {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((msg) => {
      const role = typeof msg.role === "string" ? msg.role : "user";
      const content = typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map((part) => typeof part.text === "string" ? part.text : "").join("\n")
          : "";
      return `${role.toUpperCase()}:\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function runHermes(prompt) {
  return new Promise((resolve, reject) => {
    const args = [...defaultArgs, prompt];
    const childEnv = {
      ...process.env,
      HERMES_HOME: hermesHome,
      HERMES_PROFILE: profile,
      HERMES_MODEL: model,
      HERMES_REASONING: reasoning,
      OPENAI_BASE_URL: process.env.HERMES_PROVIDER_BASE_URL || process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434/v1",
      OPENAI_API_KEY: process.env.NINEROUTER_API_KEY || process.env.OPENAI_API_KEY || "",
      HONCHO_BASE_URL: process.env.HONCHO_BASE_URL || "http://127.0.0.1:18690",
      HONCHO_WORKSPACE: process.env.HONCHO_WORKSPACE || profile,
    };
    execFile(hermesCommand, args, { env: childEnv, timeout, maxBuffer }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function health() {
  await access(hermesHome);
  await access(`${hermesHome}/cortexos-profile.json`);
  const profileConfig = JSON.parse(await readFile(`${hermesHome}/cortexos-profile.json`, "utf8"));
  return { status: "ok", profile, model, reasoning, home: hermesHome, config: profileConfig.profile };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
    if (url.pathname === "/health" && req.method === "GET") {
      send(res, 200, await health());
      return;
    }
    if (!requireAuth(req, res)) return;
    if ((url.pathname === "/v1/models" || url.pathname === "/models") && req.method === "GET") {
      send(res, 200, { object: "list", data: [{ id: model, object: "model", owned_by: "cortexos-hermes" }] });
      return;
    }
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      const body = await readJson(req);
      const prompt = messagePrompt(body.messages);
      if (!prompt.trim()) {
        send(res, 400, { error: "messages are required" });
        return;
      }
      const result = await runHermes(prompt);
      send(res, 200, {
        id: `hermes-${profile}-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: { role: "assistant", content: result.stdout.trim() },
          finish_reason: "stop",
        }],
        metadata: { profile, stderr: result.stderr?.trim() || undefined },
      });
      return;
    }
    send(res, 404, { error: "not found" });
  } catch (error) {
    send(res, 500, {
      error: error instanceof Error ? error.message : String(error),
      stderr: error && typeof error === "object" && "stderr" in error ? String(error.stderr || "") : undefined,
    });
  }
});

server.listen(port, host, () => {
  process.stdout.write(`[hermes-profile-api] profile=${profile} url=http://${host}:${port}\n`);
});
