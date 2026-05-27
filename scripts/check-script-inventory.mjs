#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";

const inventoryPath = "docs/SCRIPT-INVENTORY.md";
const allowedStatuses = new Set(["keep", "merge", "archive", "delete"]);
const allowedOwners = new Set([
  "runtime-entrypoint",
  "bootstrap-helper",
  "validator",
  "renderer-installer",
  "backup-update",
  "migration",
]);

const inventory = readFileSync(inventoryPath, "utf8");
const rows = new Map();
const failures = [];

for (const line of inventory.split("\n")) {
  if (!line.startsWith("| `scripts/")) continue;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().replace(/^`|`$/g, ""));
  const [script, status, owner] = cells;
  if (!script || !status || !owner) {
    failures.push(`${inventoryPath}: malformed row: ${line}`);
    continue;
  }
  if (rows.has(script)) failures.push(`${inventoryPath}: duplicate row for ${script}`);
  if (!allowedStatuses.has(status)) failures.push(`${script}: invalid status "${status}"`);
  if (!allowedOwners.has(owner)) failures.push(`${script}: invalid owner "${owner}"`);
  rows.set(script, { status, owner });
}

const topLevelScripts = readdirSync("scripts", { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => `scripts/${entry.name}`)
  .filter((script) => script !== "scripts/package.json")
  .sort();

for (const script of topLevelScripts) {
  if (!rows.has(script)) failures.push(`${script}: missing from ${inventoryPath}`);
}

for (const [script, row] of rows) {
  if (row.status === "delete" || row.status === "archive") continue;
  if (!topLevelScripts.includes(script)) failures.push(`${script}: inventoried but not present`);
}

if (failures.length > 0) {
  console.error("Script inventory check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Script inventory check passed: ${topLevelScripts.length} top-level scripts classified.`);
