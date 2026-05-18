// Unit tests for policy.js — schema, allow-list, quota clamping,
// network mode gating, and podman argv builder.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ExecRequestSchema,
  decide,
  buildPodmanArgs,
  DEFAULT_ALLOWED_IMAGES,
} from "../app/policy.js";

test("schema rejects empty cmd", () => {
  const r = ExecRequestSchema.safeParse({ image: "alpine:3", cmd: [] });
  assert.equal(r.success, false);
});

test("schema accepts minimal payload", () => {
  const r = ExecRequestSchema.safeParse({ image: "alpine:3", cmd: ["echo", "hi"] });
  assert.equal(r.success, true);
});

test("decide rejects unlisted image", () => {
  const r = decide({ image: "ubuntu:24.04", cmd: ["sh"] });
  assert.equal(r.ok, false);
  assert.match(r.reason, /image_not_allowed/);
});

test("decide rejects host network", () => {
  // Schema rejects `host` upstream of decide; assert at schema layer.
  const r = ExecRequestSchema.safeParse({
    image: "alpine:3", cmd: ["sh"], networkMode: "host",
  });
  assert.equal(r.success, false);
});

test("decide clamps cpu/mem/timeout to role ceiling", () => {
  const r = decide({
    image: "alpine:3", cmd: ["sh"],
    cpuMillis: 99999, memMB: 99999, timeoutSec: 9999,
    role: "ENG-BACKEND",
  });
  assert.equal(r.ok, true);
  assert.equal(r.plan.cpuMillis, 2000);
  assert.equal(r.plan.memMB, 1024);
  assert.equal(r.plan.timeoutSec, 60);
});

test("decide falls back to DEFAULT for unknown role", () => {
  const r = decide({ image: "alpine:3", cmd: ["sh"], role: "MYSTERY" });
  assert.equal(r.ok, true);
  assert.equal(r.plan.cpuMillis, 1000);
});

test("buildPodmanArgs emits runsc runtime + hardening flags", () => {
  const decision = decide({ image: "alpine:3", cmd: ["echo", "x"], role: "DEFAULT" });
  assert.equal(decision.ok, true);
  const { bin, args } = buildPodmanArgs(decision.plan);
  assert.equal(bin, "podman");
  assert.ok(args.includes("--runtime=runsc"), "must select runsc");
  assert.ok(args.includes("--rm"));
  assert.ok(args.includes("--read-only"));
  assert.ok(args.includes("--cap-drop=ALL"));
  assert.ok(args.includes("--security-opt=no-new-privileges"));
  assert.ok(args.includes("--network=none"));
  assert.ok(args.some((a) => /^--memory=/.test(a)));
  assert.ok(args.some((a) => /^--cpus=/.test(a)));
  const imageIdx = args.indexOf("alpine:3");
  assert.ok(imageIdx > 0, "image must appear in argv");
  assert.deepEqual(args.slice(imageIdx), ["alpine:3", "echo", "x"]);
});

test("default allow-list snapshot", () => {
  assert.deepEqual([...DEFAULT_ALLOWED_IMAGES], [
    "alpine:3",
    "node:22-slim",
    "python:3.13-slim",
    "debian:13-slim",
  ]);
});

test("env vars propagate via -e flags", () => {
  const decision = decide({
    image: "alpine:3", cmd: ["env"],
    env: { FOO: "bar", BAZ: "qux" },
  });
  const { args } = buildPodmanArgs(decision.plan);
  const envFlags = args.filter((_, i) => args[i - 1] === "-e");
  assert.ok(envFlags.includes("FOO=bar"));
  assert.ok(envFlags.includes("BAZ=qux"));
});
