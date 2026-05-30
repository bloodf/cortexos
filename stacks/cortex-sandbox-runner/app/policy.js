// policy.js — schema + allow-list + per-role quota table for /exec.
//
// Keep the surface tiny. Every field that ever ends up on the podman
// CLI gets validated here so the HTTP handler never has to second-
// guess input. Network modes are constrained to a small allow-list;
// `host` is explicitly forbidden (would defeat sandbox isolation).

import { z } from "zod";

export const DEFAULT_ALLOWED_IMAGES = Object.freeze([
  "alpine:3",
  "node:22-slim",
  "python:3.13-slim",
  "debian:13-slim",
]);

export const DEFAULT_ROLE_LIMITS = Object.freeze({
  DEFAULT:        { cpuMillis: 1000, memMB: 512,  timeoutSec: 30 },
  "ENG-BACKEND":  { cpuMillis: 2000, memMB: 1024, timeoutSec: 60 },
  "ENG-FRONTEND": { cpuMillis: 2000, memMB: 1024, timeoutSec: 60 },
  "ENG-MOBILE":   { cpuMillis: 2000, memMB: 1024, timeoutSec: 60 },
  "ENG-ESP32":    { cpuMillis: 1500, memMB: 768,  timeoutSec: 45 },
  ENGINEER:       { cpuMillis: 1500, memMB: 768,  timeoutSec: 45 },
});

export const ALLOWED_NETWORK_MODES = Object.freeze(["none", "bridge"]);

export const ExecRequestSchema = z.object({
  image:       z.string().min(1).max(256),
  cmd:         z.array(z.string().min(1).max(4096)).min(1).max(64),
  env:         z.record(z.string().min(1).max(128), z.string().max(4096)).optional(),
  timeoutSec:  z.number().int().positive().max(600).optional(),
  cpuMillis:   z.number().int().positive().max(8000).optional(),
  memMB:       z.number().int().positive().max(8192).optional(),
  networkMode: z.enum(["none", "bridge"]).optional(),
  role:        z.string().min(1).max(64).optional(),
  stdin:       z.string().max(64 * 1024).optional(),
});

export function decide(parsed, opts = {}) {
  const allowedImages = opts.allowedImages || DEFAULT_ALLOWED_IMAGES;
  const roleLimits = opts.roleLimits || DEFAULT_ROLE_LIMITS;
  const role = String(parsed.role || "DEFAULT").toUpperCase();
  const ceiling = roleLimits[role] || roleLimits.DEFAULT;

  if (!allowedImages.includes(parsed.image)) {
    return { ok: false, reason: `image_not_allowed:${parsed.image}` };
  }
  const networkMode = parsed.networkMode || "none";
  if (!ALLOWED_NETWORK_MODES.includes(networkMode)) {
    return { ok: false, reason: `network_mode_not_allowed:${networkMode}` };
  }
  const cpuMillis = Math.min(parsed.cpuMillis ?? ceiling.cpuMillis, ceiling.cpuMillis);
  const memMB = Math.min(parsed.memMB ?? ceiling.memMB, ceiling.memMB);
  const timeoutSec = Math.min(parsed.timeoutSec ?? ceiling.timeoutSec, ceiling.timeoutSec);

  return {
    ok: true,
    plan: Object.freeze({
      image: parsed.image,
      cmd: Object.freeze([...parsed.cmd]),
      env: Object.freeze({ ...(parsed.env || {}) }),
      cpuMillis,
      memMB,
      timeoutSec,
      networkMode,
      role,
      stdin: parsed.stdin || "",
    }),
  };
}

/**
 * Translate a decided plan into argv for `podman run`.
 * Runtime is configurable so the operator can prefer `runsc` and fall back to
 * `crun` on kernels/hosts where nested gVisor is not viable.
 */
export function buildPodmanArgs(plan, opts = {}) {
  const bin = opts.podmanBin || process.env.CORTEX_SANDBOX_PODMAN_BIN || "podman";
  const runtime = process.env.CORTEX_SANDBOX_OCI_RUNTIME || "runsc";
  const disableCgroups = process.env.CORTEX_SANDBOX_DISABLE_CGROUPS === "1";
  const args = [
    `--runtime=${runtime}`,
    "run",
    "--rm",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    `--network=${plan.networkMode}`,
    "--tmpfs=/tmp:rw,nosuid,nodev,size=64m",
    "--user=65532:65532",
  ];
  if (disableCgroups) {
    args.push("--cgroups=disabled");
  } else {
    args.push(`--memory=${plan.memMB}m`);
    args.push(`--cpus=${(plan.cpuMillis / 1000).toFixed(3)}`);
    args.push("--pids-limit=128");
  }
  for (const [k, v] of Object.entries(plan.env)) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(plan.image, ...plan.cmd);
  return { bin, args };
}
