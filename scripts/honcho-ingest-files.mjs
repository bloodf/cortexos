#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (!next || next.startsWith("--")) args.set(key, "true");
  else {
    args.set(key, next);
    i += 1;
  }
}

const source = args.get("source");
const workspace = args.get("workspace") || "primary";
const peer = args.get("peer") || `${workspace}-knowledge`;
const session = args.get("session") || `operator-ingest-${new Date().toISOString().slice(0, 10)}`;
const baseUrl = (args.get("honcho-url") || process.env.HONCHO_BASE_URL || "http://127.0.0.1:18690").replace(/\/$/, "");
const apiKey = args.get("api-key") || process.env.HONCHO_API_KEY || "";
const maxChars = Number(args.get("max-chars") || 24000);
const batchSize = Number(args.get("batch-size") || 50);
const dryRun = args.has("dry-run");

if (!source) throw new Error("usage: node scripts/honcho-ingest-files.mjs --source <file-or-directory> --workspace <id> [--dry-run]");
if (!existsSync(source)) throw new Error(`source not found: ${source}`);
if (!dryRun && !apiKey) throw new Error("HONCHO_API_KEY is required unless --dry-run is set");

async function walk(path) {
  const st = statSync(path);
  if (st.isFile()) return [path];
  const out = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) out.push(...await walk(child));
    else out.push(child);
  }
  return out;
}

function isIngestible(path) {
  return /\.(md|txt|json|jsonl|yaml|yml)$/i.test(path);
}

function cleanText(input) {
  return input
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

async function post(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Honcho ${path} returned HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json().catch(() => ({}));
}

const sourceRoot = statSync(source).isDirectory() ? source : join(source, "..");
const files = (await walk(source)).filter(isIngestible).sort();
const messages = [];

for (const file of files) {
  let content;
  try {
    content = cleanText(await readFile(file, "utf8"));
  } catch {
    continue;
  }
  if (!content) continue;
  const rel = relative(sourceRoot, file) || basename(file);
  messages.push({
    peer_id: peer,
    content: `Source: ${rel}\n\n${content.slice(0, maxChars)}`,
    metadata: {
      source: "operator-file-ingest",
      file: rel,
      basename: basename(file),
      truncated: content.length > maxChars,
    },
  });
}

if (!dryRun && messages.length) {
  await post("/v3/workspaces", { id: workspace });
  await post(`/v3/workspaces/${encodeURIComponent(workspace)}/peers`, { id: peer });
  await post(`/v3/workspaces/${encodeURIComponent(workspace)}/peers`, { id: workspace });
  await post(`/v3/workspaces/${encodeURIComponent(workspace)}/sessions`, { id: session });
  for (let i = 0; i < messages.length; i += batchSize) {
    await post(
      `/v3/workspaces/${encodeURIComponent(workspace)}/sessions/${encodeURIComponent(session)}/messages`,
      { messages: messages.slice(i, i + batchSize) },
    );
  }
}

console.log(JSON.stringify({
  workspace,
  peer,
  session,
  source,
  files: files.length,
  messages: messages.length,
  applied: !dryRun,
}, null, 2));
