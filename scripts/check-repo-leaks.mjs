#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const allowed = new Set([
  "packages/cortex-dashboard/src/lib/db/migrate.test.ts",
  "scripts/check-repo-leaks.mjs",
]);
const ignoredPrefixes = [
  "node_modules/",
  "templates/.secrets/",
  "packages/cortex-dashboard/.next/",
  "scripts/node_modules/",
  ".git/",
];

const patterns = [
  { name: "expo token", re: /\bAqRY[0-9A-Za-z_-]{20,}\b/ },
  { name: "zai key", re: /\b[a-f0-9]{32}\.g[0-9A-Za-z]{8,}\b/i },
  { name: "long raw token", re: /\b[a-f0-9]{64,}\b/i },
  { name: "macos user path", re: /\/Users\/[A-Za-z0-9._-]+/ },
  { name: "home user path", re: /\/home\/(?!cortexos\b|linuxbrew\b|sandbox\b)[A-Za-z0-9._-]+/ },
  { name: "private ip", re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b(?!\/\d{1,2})/ },
  { name: "tailscale machine hostname", re: /\b[a-z0-9-]+\.tail[a-z0-9]+\.ts\.net\b/i },
  { name: "non-cortex profile name", re: /\b(?:cieucpb|netbook)\b/i },
];
const allowedLinePatterns = [
  /\b(?:10\.0\.0\.0\/8|172\.16\.0\.0\/12|192\.168\.0\.0\/16)\b/,
  /\b172\.17\.0\.1\b/,
  /\b172\.30\.0\.1\b/,
];

const failures = [];

function ignored(path) {
  return allowed.has(path) || ignoredPrefixes.some((prefix) => path.startsWith(prefix));
}

function scanText(path, text) {
  for (const line of text.split("\n")) {
    if (allowedLinePatterns.some((pattern) => pattern.test(line))) continue;
    for (const pattern of patterns) {
      if (pattern.re.test(line)) failures.push(`${path}: ${pattern.name}`);
    }
  }
}

function scanDiff() {
  const diff = execFileSync("git", ["diff", "--unified=0", "--diff-filter=ACMRTUXB", "HEAD"], {
    encoding: "utf8",
  });
  let currentFile = "";
  for (const rawLine of diff.split("\n")) {
    if (rawLine.startsWith("+++ b/")) {
      currentFile = rawLine.slice("+++ b/".length);
      continue;
    }
    if (!currentFile || ignored(currentFile)) continue;
    if (!rawLine.startsWith("+") || rawLine.startsWith("+++")) continue;
    scanText(currentFile, rawLine.slice(1));
  }
}

function scanAll() {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"], { encoding: "utf8" });
  const files = [...new Set(`${tracked}\n${untracked}`.split("\n").filter(Boolean))];
  for (const file of files) {
    if (ignored(file)) continue;
    try {
      const text = readFileSync(file, "utf8");
      if (text.includes("\u0000")) continue;
      scanText(file, text);
    } catch {
      // Binary or unreadable files are skipped by this lightweight gate.
    }
  }
}

if (process.argv.includes("--all")) scanAll();
else scanDiff();

if (failures.length > 0) {
  console.error("Repository leak check failed:");
  for (const failure of [...new Set(failures)]) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Repository leak check passed");
