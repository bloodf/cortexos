#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const key = arg.slice(2);
    const next = process.argv[i + 1];
    if (!next || next.startsWith("--")) args.set(key, "true");
    else {
      args.set(key, next);
      i += 1;
    }
  }
}

const backup = args.get("backup") || "/opt/cortexos/backups/memory-import-pending/live-agent-state.tar.gz";
const workspace = args.get("profile") || args.get("workspace") || "primary";
const peer = args.get("peer") || `legacy-import-${workspace}`;
const session = args.get("session") || "legacy-memory-import";
const apply = args.has("apply");
const importConclusions = args.has("conclusions");
const baseUrl = (args.get("honcho-url") || process.env.HONCHO_BASE_URL || "http://127.0.0.1:18690").replace(/\/$/, "");
const apiKey = args.get("api-key") || process.env.HONCHO_API_KEY || "";
const outDir = args.get("out-dir") || "/opt/cortexos/backups/memory-import-pending";
const maxFiles = Number(args.get("max-files") || 5000);
const maxChars = Number(args.get("max-chars") || 12000);

if (!existsSync(backup)) {
  throw new Error(`backup not found: ${backup}`);
}

function isTextFile(name) {
  return /\.(md|txt|json|jsonl|yaml|yml|toml|log|py)$/i.test(name);
}

function shouldSkipRelPath(relPath) {
  const parts = relPath.split("/");
  return parts.includes(".git") ||
    parts.includes("node_modules") ||
    parts.includes("__pycache__") ||
    parts.includes(".venv") ||
    parts.includes("secrets");
}

function matchesWorkspace(relPath) {
  const parts = relPath.split("/");
  return parts[1] === workspace;
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
  if (!apiKey) throw new Error("HONCHO_API_KEY or --api-key is required with --apply");
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Honcho ${path} returned HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json().catch(() => ({}));
}

async function ensurePost(path, body) {
  try {
    return await post(path, body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("HTTP 409") || message.includes("already exists")) return {};
    throw error;
  }
}

const temp = await mkdtemp(join(tmpdir(), "cortexos-memory-import-"));
try {
  execFileSync("tar", ["-xzf", backup, "-C", temp], { stdio: "ignore" });
  const allFiles = execFileSync("find", [temp, "-type", "f"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const listing = allFiles
    .map((file) => ({ file, relPath: file.slice(temp.length + 1) }))
    .filter(({ relPath }) => matchesWorkspace(relPath))
    .filter(({ relPath }) => !shouldSkipRelPath(relPath))
    .filter(({ relPath }) => isTextFile(relPath))
    .slice(0, maxFiles);

  const messages = [];
  for (const { file, relPath } of listing) {
    let content;
    try {
      content = cleanText(await readFile(file, "utf8"));
    } catch {
      continue;
    }
    if (!content) continue;
    messages.push({
      content: content.slice(0, maxChars),
      peer_id: peer,
      metadata: {
        source: "legacy-memory-import",
        backup: basename(backup),
        path: relPath,
        truncated: content.length > maxChars,
      },
    });
  }

  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${workspace}-${session}.jsonl`);
  await writeFile(outPath, messages.map((msg) => JSON.stringify(msg)).join("\n") + "\n");

  if (apply && messages.length) {
    await ensurePost(`/v3/workspaces`, { id: workspace });
    await ensurePost(
      `/v3/workspaces/${encodeURIComponent(workspace)}/peers`,
      { id: peer },
    );
    await ensurePost(
      `/v3/workspaces/${encodeURIComponent(workspace)}/peers`,
      { id: workspace },
    );
    await ensurePost(
      `/v3/workspaces/${encodeURIComponent(workspace)}/sessions`,
      { id: session },
    );
    for (let i = 0; i < messages.length; i += 100) {
      const batch = messages.slice(i, i + 100);
      await post(
        `/v3/workspaces/${encodeURIComponent(workspace)}/sessions/${encodeURIComponent(session)}/messages`,
        { messages: batch },
      );
    }
    if (importConclusions) {
      for (let i = 0; i < messages.length; i += 100) {
        const conclusions = messages.slice(i, i + 100).map((message) => ({
          content: message.content,
          observer_id: peer,
          observed_id: workspace,
          session_id: session,
        }));
        await post(
          `/v3/workspaces/${encodeURIComponent(workspace)}/conclusions`,
          { conclusions },
        );
      }
    }
  }

  console.log(JSON.stringify({
    workspace,
    peer,
    session,
    totalFiles: allFiles.length,
    selectedFiles: listing.length,
    messages: messages.length,
    outPath,
    applied: apply,
    conclusions: apply && importConclusions,
  }, null, 2));
} finally {
  await rm(temp, { recursive: true, force: true });
}
