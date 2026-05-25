#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const packageRoot = process.argv[2];
const prefix = (process.argv[3] || "/9router").replace(/\/+$/, "");

if (!packageRoot) {
  console.error("usage: patch-9router-prefix.js <9router-package-root> [/9router]");
  process.exit(64);
}

if (!fs.existsSync(packageRoot)) {
  console.error(`9Router package root not found: ${packageRoot}`);
  process.exit(66);
}

const buildRoot = path.join(packageRoot, "app", ".next-cli-build");
const serverAppRoot = path.join(buildRoot, "server", "app");
const staticRoot = path.join(buildRoot, "static");

const textExts = new Set([".html", ".js", ".css", ".json", ".rsc", ".txt"]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    if (entry.isFile() && textExts.has(path.extname(file))) files.push(file);
  }
  return files;
}

function patchFile(file, replacements, backupSuffix) {
  const original = fs.readFileSync(file, "utf8");
  let next = original;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next === original) return false;

  const backup = `${file}.${backupSuffix}`;
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  fs.writeFileSync(file, next);
  return true;
}

// Keep 9Router's local API contract intact. CortexOS clients call
// http://127.0.0.1:11434/v1/* directly, so do not force Next basePath at
// runtime. Caddy strips /9router before proxying instead.
for (const file of [
  path.join(packageRoot, "app", "server.js"),
  path.join(buildRoot, "required-server-files.json"),
  path.join(buildRoot, "routes-manifest.json"),
]) {
  if (!fs.existsSync(file)) continue;
  patchFile(
    file,
    [
      [`"basePath":"${prefix}"`, '"basePath":""'],
      [`"assetPrefix":"${prefix}"`, '"assetPrefix":""'],
    ],
    "cortexos-pre-9router-basepath",
  );
}

let patched = 0;
for (const file of [...walk(serverAppRoot), ...walk(staticRoot)]) {
  if (
    patchFile(
      file,
      [
        ['"/_next', `"${prefix}/_next`],
        ["'/_next", `'${prefix}/_next`],
        ['"/dashboard', `"${prefix}/dashboard`],
        ["'/dashboard", `'${prefix}/dashboard`],
        ['"/api/', `"${prefix}/api/`],
        ["'/api/", `'${prefix}/api/`],
        ['"/api"', `"${prefix}/api"`],
        ["'/api'", `'${prefix}/api'`],
        ['"/manifest.webmanifest', `"${prefix}/manifest.webmanifest`],
        ['"/favicon', `"${prefix}/favicon`],
      ],
      "cortexos-pre-9router-prefix",
    )
  ) {
    patched += 1;
  }
}

console.log(`9Router prefix patch complete: ${patched} emitted files updated`);
