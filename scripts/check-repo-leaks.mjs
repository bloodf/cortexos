#!/usr/bin/env node
import { execFileSync } from "node:child_process";
const allowed = new Set([
  "scripts/check-repo-leaks.mjs",
]);

const diff = execFileSync("git", ["diff", "--unified=0", "--diff-filter=ACMRTUXB", "HEAD"], {
  encoding: "utf8",
});

const patterns = [
  { name: "expo token", re: /\bAqRY[0-9A-Za-z_-]{20,}\b/ },
  { name: "zai key", re: /\b[a-f0-9]{32}\.g[0-9A-Za-z]{8,}\b/i },
  { name: "long raw token", re: /\b[a-f0-9]{64,}\b/i },
  { name: "macos user path", re: /\/Users\/[A-Za-z0-9._-]+/ },
  { name: "home user path", re: /\/home\/[A-Za-z0-9._-]+/ },
  { name: "private ip", re: /\b(?:10|127|172\.(?:1[6-9]|2\d|3[0-1])|192\.168)\.\d{1,3}\.\d{1,3}\b/ },
  { name: "non-cortex profile name", re: /\b(?:cieucpb|netbook)\b/i },
];

const failures = [];
let currentFile = "";

for (const rawLine of diff.split("\n")) {
  if (rawLine.startsWith("+++ b/")) {
    currentFile = rawLine.slice("+++ b/".length);
    continue;
  }
  if (!currentFile || allowed.has(currentFile)) continue;
  if (!rawLine.startsWith("+") || rawLine.startsWith("+++")) continue;
  const text = rawLine.slice(1);
  for (const pattern of patterns) {
    if (pattern.re.test(text)) {
      failures.push(`${currentFile}: ${pattern.name}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Repository leak check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Repository leak check passed");
