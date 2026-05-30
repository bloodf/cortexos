#!/usr/bin/env node
/**
 * schema-version-check.js — fail PR if a published schema file under schemas/
 * has been modified (anything other than docs/whitespace changes) without a
 * co-introduced higher-version sibling.
 *
 * Heuristic: if a versioned schema file `<base>-v<N>.json` appears in `git diff`
 * vs base (default `origin/main`) AND no NEW file `<base>-v<N+M>.json` is also
 * present in the diff, fail.
 *
 * Usage:
 *   node scripts/schema-version-check.js              # diff vs origin/main
 *   BASE_REF=main node scripts/schema-version-check.js
 *
 * Exits non-zero on policy violation.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const BASE = process.env.BASE_REF || "origin/main";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch (e) {
    process.stderr.write(`[schema-version-check] command failed: ${cmd}\n${e.message}\n`);
    return "";
  }
}

const VERSIONED = /^schemas\/(.+)-v(\d+)\.json$/;

function main() {
  const nameStatus = run(`git diff --name-status ${BASE}...HEAD -- schemas/`);
  if (!nameStatus) {
    process.stdout.write("[schema-version-check] no schema changes\n");
    return;
  }

  const modified = new Map(); // base → [versions]
  const added = new Map();    // base → [versions]

  for (const line of nameStatus.split("\n")) {
    const [status, ...rest] = line.split(/\s+/);
    const path = rest.join(" ");
    const m = path.match(VERSIONED);
    if (!m) continue;
    const [, base, vStr] = m;
    const v = Number(vStr);
    if (status === "A") {
      if (!added.has(base)) added.set(base, []);
      added.get(base).push(v);
    } else if (status === "M" || status === "D" || status === "R") {
      if (!modified.has(base)) modified.set(base, []);
      modified.get(base).push(v);
    }
  }

  const violations = [];
  for (const [base, versions] of modified) {
    const newVersions = (added.get(base) || []).filter((v) => v > Math.max(...versions));
    if (newVersions.length === 0) {
      violations.push(`${base}-v${versions.join(",v")}.json modified without a higher-version sibling — bump v${Math.max(...versions) + 1}`);
    }
  }

  if (violations.length) {
    process.stderr.write("[schema-version-check] VIOLATIONS:\n");
    for (const v of violations) process.stderr.write(`  - ${v}\n`);
    process.stderr.write("\nIf the change is purely cosmetic (whitespace/comments) restore the file and re-run.\n");
    process.exit(1);
  }

  process.stdout.write("[schema-version-check] ok\n");
}

if (!existsSync("schemas")) {
  process.stderr.write("[schema-version-check] schemas/ not found — skipping\n");
  process.exit(0);
}

main();
