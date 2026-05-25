#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("find", ["prompts", "-type", "f", "-name", "*.md"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const failures = [];
const forbidden = [
  {
    name: "required environment block",
    re: /\bRequired environment\s*:/i,
  },
  {
    name: "pre-prompt export placeholder",
    re: /^export\s+[A-Z0-9_]+=<[^>]+>/m,
  },
  {
    name: "operator edit env before input gate",
    re: /Edit `[^`]+\.env` locally/i,
  },
];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (!file.endsWith("CHAT-INPUT-CONTRACT.md") && !text.includes("## Chat Input Gate")) {
    failures.push(`${file}: missing Chat Input Gate`);
  }
  for (const rule of forbidden) {
    if (rule.re.test(text)) failures.push(`${file}: ${rule.name}`);
  }
}

if (failures.length > 0) {
  console.error("Prompt chat contract check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Prompt chat contract check passed");
