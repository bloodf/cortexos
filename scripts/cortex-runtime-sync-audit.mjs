#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const repoRoot = resolve(process.cwd());
const runtimeRoot = resolve(
  process.env.CORTEX_RUNTIME_ROOT ||
    process.argv.find((arg) => arg.startsWith("--runtime-root="))?.split("=").slice(1).join("=") ||
    "/opt/cortexos",
);
const strict = process.argv.includes("--strict");

const includeRoots = [
  "README.md",
  "SETUP.md",
  "package.json",
  "docs",
  "prompts",
  "schemas",
  "templates",
  "packages/cortex-dashboard/dashboard.env.example",
  "packages/cortex-dashboard/migrations",
  "scripts",
];

const ignoredPrefixes = [
  ".git/",
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  "out/",
  ".cache/",
  "coverage/",
  "templates/.secrets/",
  "scripts/node_modules/",
  "scripts/__tests__/",
  "scripts/smoke-all-agents.js",
];

function normalize(path) {
  return path.split("\\").join("/");
}

function ignored(relPath) {
  const rel = normalize(relPath);
  return ignoredPrefixes.some((prefix) => rel === prefix.replace(/\/$/, "") || rel.startsWith(prefix));
}

function digest(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return `link:${readlinkSync(path)}`;
  if (!stat.isFile()) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collect(root, base = root, labelRoot = "") {
  if (!existsSync(root)) return new Map();
  const stat = lstatSync(root);
  if (stat.isFile() || stat.isSymbolicLink()) {
    const rel = normalize(labelRoot || relative(base, root));
    return ignored(rel) ? new Map() : new Map([[normalize(relative(base, root)) || ".", digest(root)]]);
  }

  const out = new Map();
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name);
      const relToBase = normalize(relative(base, abs));
      const relToLabel = normalize(labelRoot ? `${labelRoot}/${relToBase}` : relToBase);
      if (ignored(relToLabel)) continue;
      if (entry.isDirectory()) {
        stack.push(abs);
        continue;
      }
      if (entry.isFile() || entry.isSymbolicLink()) {
        out.set(relToBase, digest(abs));
      }
    }
  }
  return out;
}

const mismatches = [];

for (const includeRoot of includeRoots) {
  const repoPath = join(repoRoot, includeRoot);
  const runtimePath = join(runtimeRoot, includeRoot);
  const repoFiles = collect(repoPath, repoPath, includeRoot);
  const runtimeFiles = collect(runtimePath, runtimePath, includeRoot);
  const keys = new Set([...repoFiles.keys(), ...runtimeFiles.keys()]);
  for (const key of [...keys].sort()) {
    const label = key === "." ? includeRoot : `${includeRoot}/${key}`;
    if (!repoFiles.has(key)) mismatches.push({ type: "runtime-only", path: label });
    else if (!runtimeFiles.has(key)) mismatches.push({ type: "repo-only", path: label });
    else if (repoFiles.get(key) !== runtimeFiles.get(key)) mismatches.push({ type: "differs", path: label });
  }
}

if (mismatches.length) {
  console.error(`Runtime sync audit found ${mismatches.length} mismatch(es):`);
  for (const item of mismatches) console.error(`- ${item.type}: ${item.path}`);
  if (strict) process.exit(1);
} else {
  console.log(`Runtime sync audit passed for ${runtimeRoot}`);
}
