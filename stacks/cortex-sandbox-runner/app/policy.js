// policy.js — schema + allow-list + per-role quota table for /exec.
//
// Keep the surface tiny. Every field that ever ends up on the podman
// CLI gets validated here so the HTTP handler never has to second-
// guess input. Network modes are constrained to a small allow-list;
// `host` is explicitly forbidden (would defeat gVisor isolation).

import { z } from "zod";

// Base images that may be requested. Anything outside this list is
// rejected at the policy gate. Pin tags to major version only — the
// service pulls on first use and caches under rootless podman's
// per-user storage, so callers should not chase "latest".
export const DEFAULT_ALLOWED_IMAGES = Object.freeze([
  "alpine:3",
  "node:22-slim",
  "python:3.13-slim",
  "debian:13-slim",
]);

// Per-role quota ceilings. The HTTP request may request lower values;
// requests above the ceiling are clamped (not rejected) so a buggy
// caller doesn't trip a hard error for asking for "too many" cores.
//
// Roles are uppercased on lookup. Unknown roles fall back to DEFAULT.
export const DEFAULT_ROLE_LIMITS = Object.freeze({
  DEFAULT:        { cpuMillis: 1000, memMB: 512,  timeoutSec: 30 },
  "ENG-BACKEND":  { cpuMillis: 2000, memMB: 1024, timeoutSec: 60 },
  "ENG-FRONTEND": { cpuMillis: 2000, memMB: 1024, timeoutSec: 60 },
  "ENG-MOBILE":   { cpuMillis: 2000, memMB: 1024, timeoutSec: 60 },
  "ENG-ESP32":    { cpuMillis: 1500, memMB: 768,  timeoutSec: 45 },
  ENGINEER:       { cpuMillis: 1500, memMB: 768,  timeoutSec: 45 },
});

export const ALLOWED_NETWORK_MODES = Object.freeze(["none", "bridge"]);

// Zod schema for /exec input. Keep coercions tight — every value
// flows into argv for podman; loose typing is a foot-gun.
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

/**
 * Build the effective policy decision for a parsed request. Returns
 * `{ ok: true, plan }` on success and `{ ok: false, reason }` on
 * rejection. Quotas are clamped to the per-role ceiling; explicit
 * image / network rejections fail closed.
 */
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
 * Translate a decided plan into the argv for
 * `podman --runtime=runsc run --rm ...`. Returns the full argv
 * including the leading `podman` binary so callers can swap the
 * spawn target for tests.
 */
export function buildPodmanArgs(plan, opts = {}) {
  const bin = opts.podmanBin || "podman";
  const args = [
    "--runtime=runsc",
    "run",
    "--rm",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    `--network=${plan.networkMode}`,
    `--memory=${plan.memMB}m`,
    `--cpus=${(plan.cpuMillis / 1000).toFixed(3)}`,
    "--pids-limit=128",
    "--tmpfs=/tmp:rw,nosuid,nodev,size=64m",
  ];
  for (const [k, v] of Object.entries(plan.env)) {
    args.push("-e", `${k}=${v}`);
  }
  args.push(plan.image, ...plan.cmd);
  return { bin, args };
}
