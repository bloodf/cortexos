import http from "node:http";
import { execFile } from "node:child_process";
import { access, readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const profile = process.env.HERMES_PROFILE || process.argv[2] || "default";
const host = process.env.HERMES_API_HOST || "127.0.0.1";
const port = Number(process.env.HERMES_API_PORT || 18691);
const model = process.env.HERMES_MODEL || "claude-fallback";
const reasoning = process.env.HERMES_REASONING || "medium";
const hermesCommand = process.env.HERMES_COMMAND || "hermes";
const hermesHome = process.env.HERMES_HOME || `/opt/cortexos/hermes/profiles/${profile}`;

const apiKey = process.env.HERMES_API_KEY || "";
const defaultArgs = (process.env.HERMES_CHAT_ARGS || "chat -Q").split(/\s+/).filter(Boolean);
const maxBuffer = Number(process.env.HERMES_API_MAX_BUFFER || 1024 * 1024 * 8);
const timeout = Number(process.env.HERMES_API_TIMEOUT_MS || 300000);

// P1.1 — attachment caps and validation.
const MAX_ATTACHMENTS = Number(process.env.HERMES_MAX_ATTACHMENTS || 8);
const MAX_ATTACHMENT_BYTES = Number(process.env.HERMES_MAX_ATTACHMENT_BYTES || 25 * 1024 * 1024);
const MAX_FILENAME_LEN = 255;
const MIME_RE = /^[a-zA-Z0-9!#$&\-+.^_/]+\/[a-zA-Z0-9!#$&\-+.^_*]+$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

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

// P1.1 — sanitize an attachment filename to a bare basename. Anything that
// could escape the tmp dir (`..`, path separators, leading dots) is stripped.
function sanitizeBasename(filename) {
  const base = path.basename(String(filename || "")).replace(/^\.+/, "");
  if (!base || base.length > MAX_FILENAME_LEN) return null;
  if (base.includes("/") || base.includes("\\") || base.includes("..")) return null;
  return base;
}

// P1.1 — write attachments to a per-request tmp dir. Returns an object with
// the dir (for cleanup), the list of absolute staged paths, and the total
// decoded byte count. Throws a structured error on validation failure.
async function stageAttachments(tmpDir, attachments) {
  const staged = [];
  let totalBytes = 0;
  let idx = 0;
  for (const att of attachments) {
    idx += 1;
    const filename = sanitizeBasename(att?.filename);
    if (!filename) {
      const err = new Error("bad_attachment");
      err.code = "bad_attachment";
      err.detail = `attachment ${idx} has an invalid filename`;
      throw err;
    }
    const mime = typeof att?.mime === "string" && MIME_RE.test(att.mime) ? att.mime : "application/octet-stream";
    const dataStr = typeof att?.dataBase64 === "string" ? att.dataBase64 : "";
    if (
      !dataStr ||
      dataStr.length % 4 !== 0 ||
      !BASE64_RE.test(dataStr)
    ) {
      const err = new Error("bad_attachment");
      err.code = "bad_attachment";
      err.detail = `attachment ${idx} (${filename}) is not valid base64`;
      throw err;
    }
    let buf;
    try {
      buf = Buffer.from(dataStr, "base64");
    } catch {
      const err = new Error("bad_attachment");
      err.code = "bad_attachment";
      err.detail = `attachment ${idx} (${filename}) could not be decoded`;
      throw err;
    }
    // Round-trip: a well-formed canonical base64 string re-encodes to itself.
    // Catches garbage that `Buffer.from` silently tolerates (e.g. trailing
    // bits in the final group, lengths not divisible by 4).
    if (buf.toString("base64") !== dataStr) {
      const err = new Error("bad_attachment");
      err.code = "bad_attachment";
      err.detail = `attachment ${idx} (${filename}) is not canonical base64`;
      throw err;
    }
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_ATTACHMENT_BYTES) {
      const err = new Error("attachments_too_large");
      err.code = "attachments_too_large";
      err.detail = `attachments exceed ${MAX_ATTACHMENT_BYTES} bytes`;
      throw err;
    }
    const dest = path.join(tmpDir, filename);
    // Ensure unique filenames don't overwrite earlier siblings.
    const unique = staged.includes(dest) ? path.join(tmpDir, `${idx}-${filename}`) : dest;
    await writeFile(unique, buf, { mode: 0o600 });
    staged.push(unique);
    void mime; // retained on disk; the prompt only needs the path list below.
  }
  return { staged, totalBytes };
}

function buildArgsOverrides(modelOverride, reasoningOverride) {
  const extra = [];
  if (modelOverride && typeof modelOverride === "string" && modelOverride.length <= 128) {
    extra.push("--model", modelOverride);
  }
  if (
    reasoningOverride &&
    ["low", "medium", "high"].includes(reasoningOverride)
  ) {
    extra.push("--reasoning", reasoningOverride);
  }
  return extra;
}

async function runHermes(prompt, overrides) {
  // Hermes 0.17: -q/--query now takes the prompt as its argument, so a bare
  // -q in defaultArgs breaks when --model is inserted before the prompt.
  // Strip any -q/--query and always pass the prompt via --query AFTER overrides.
  const baseArgs = defaultArgs.filter((a) => a !== "-q" && a !== "--query");
  const args = [...baseArgs, ...overrides, "--query", prompt];
  const childEnv = {
    ...process.env,
    HERMES_HOME: hermesHome,
    HERMES_PROFILE: profile,
    HERMES_MODEL: model,
    HERMES_REASONING: reasoning,
    OPENAI_BASE_URL: process.env.HERMES_PROVIDER_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    HONCHO_BASE_URL: process.env.HONCHO_BASE_URL || "http://127.0.0.1:18690",
    HONCHO_WORKSPACE: process.env.HONCHO_WORKSPACE || profile,
    // Some local gateways do not yet map the OpenAI "developer" role to
    // "system". Hermes converts system prompts to "developer" for GPT-5/Codex
    // model names; force the classic "system" role so the injected SOUL.md
    // identity reaches the provider.
    HERMES_FORCE_SYSTEM_ROLE: "1",
  };

  // Inject the profile-specific SOUL.md as an ephemeral system prompt when
  // available. Hermes normally reads ~/.hermes/SOUL.md, so this makes the
  // CortexOS profile identity explicit for the spawned CLI invocation.
  const soulPath = path.join(hermesHome, "SOUL.md");
  try {
    const soul = await readFile(soulPath, "utf8");
    if (soul.trim()) {
      childEnv.HERMES_EPHEMERAL_SYSTEM_PROMPT = soul.trim();
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(`[hermes-profile-api] failed to read ${soulPath}:`, err.message);
    }
  }

  return new Promise((resolve, reject) => {
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

      // P1.1 — validate attachment count up-front so we never spawn hermes
      // nor create a tmp dir for a request that will be rejected anyway.
      const attachments = Array.isArray(body.attachments) ? body.attachments : [];
      if (attachments.length > MAX_ATTACHMENTS) {
        send(res, 400, {
          error: "too_many_attachments",
          detail: `at most ${MAX_ATTACHMENTS} attachments per request`,
        });
        return;
      }

      const overrides = buildArgsOverrides(body.model, body.reasoning);

      // No attachments → original code path (no tmp dir, no cleanup).
      if (attachments.length === 0) {
        const result = await runHermes(prompt, overrides);
        send(res, 200, {
          id: `hermes-${profile}-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: body.model || model,
          choices: [{
            index: 0,
            message: { role: "assistant", content: result.stdout.trim() },
            finish_reason: "stop",
          }],
          metadata: { profile, stderr: result.stderr?.trim() || undefined },
        });
        return;
      }

      // P1.1 — stage attachments to a per-request tmp dir and append their
      // absolute paths to the prompt. The dir is always removed afterwards.
      const tmpRoot = await mkdtemp(path.join(tmpdir(), `hermes-chat-${profile}-`));
      let result;
      try {
        const { staged } = await stageAttachments(tmpRoot, attachments);
        const fullPrompt = `${prompt}\n\n[attachments]\n${staged.join("\n")}\n`;
        result = await runHermes(fullPrompt, overrides);
      } catch (stageErr) {
        if (stageErr && stageErr.code === "attachments_too_large") {
          send(res, 413, { error: "attachments_too_large", detail: stageErr.detail });
        } else if (stageErr && stageErr.code === "bad_attachment") {
          send(res, 400, { error: "bad_attachment", detail: stageErr.detail });
        } else {
          throw stageErr;
        }
        return;
      } finally {
        await rm(tmpRoot, { recursive: true, force: true });
      }

      send(res, 200, {
        id: `hermes-${profile}-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: body.model || model,
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
