// @vitest-environment node
/**
 * P1.1 — hermes-profile-api.mjs attachment + model-override limits.
 *
 * Spawns the host profile API as a child process with a fake `hermes` stub
 * on PATH and exercises its `/v1/chat/completions` endpoint:
 *   - oversized attachments → 413 `attachments_too_large`
 *   - malformed base64       → 400 `bad_attachment`
 *   - too many attachments   → 400 `too_many_attachments`
 *   - happy path             → 200 + staged paths cleaned up
 *
 * The script lives at `/opt/cortexos/scripts/hermes-profile-api.mjs`
 * (gitignored host runtime — see docs/host-patches/0001-…). On hosts/CI
 * without it, the suite skips.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const SCRIPT = "/opt/cortexos/scripts/hermes-profile-api.mjs";
const API_KEY = "p1-test-key";
const CONST_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const describeIfHostScript = existsSync(SCRIPT) ? describe : describe.skip;

async function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") resolve(addr.port);
      else reject(new Error("no port"));
      srv.close();
    });
  });
}

async function waitForServer(proc: ChildProcess, marker: RegExp): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onExit = (code: number | null) =>
      reject(new Error(`profile-api exited with ${code} before ready`));
    proc.once("exit", onExit);
    proc.stderr?.on("data", (b: Buffer) =>
      reject(new Error(`profile-api stderr: ${b.toString("utf8")}`)),
    );
    proc.stdout?.on("data", (b: Buffer) => {
      if (marker.test(b.toString("utf8"))) resolve();
    });
  });
}

let tmpBin: string;
let serverProc: ChildProcess | null = null;
let baseUrl = "";

beforeAll(async () => {
  if (!existsSync(SCRIPT)) return;
  tmpBin = mkdtempSync(path.join(os.tmpdir(), "hermes-api-test-bin-"));
  // Fake `hermes` stub: echo its prompt argv on stdout so the test can see
  // whether attachment paths were appended, then exit 0.
  const fakeHermes = path.join(tmpBin, "hermes");
  writeFileSync(
    fakeHermes,
    [
      "#!/usr/bin/env node",
      "// Last argv is the prompt; echo it so callers can assert attachment paths.",
      "process.stdout.write(process.argv[process.argv.length - 1]);",
      "process.exit(0);",
      "",
    ].join("\n"),
    { mode: 0o755 },
  );

  const port = await freePort();
  serverProc = spawn(process.execPath, [SCRIPT], {
    env: {
      ...process.env,
      PATH: `${tmpBin}:${process.env.PATH ?? ""}`,
      HERMES_PROFILE: "p1test",
      HERMES_API_PORT: String(port),
      HERMES_API_HOST: "127.0.0.1",
      HERMES_COMMAND: "hermes",
      HERMES_API_KEY: API_KEY,
      HERMES_HOME: os.tmpdir(),
      HERMES_MAX_ATTACHMENT_BYTES: String(1024),
      HERMES_MAX_ATTACHMENTS: String(2),
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(serverProc, /url=http:\/\/127\.0\.0\.1/);
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  serverProc?.kill("SIGTERM");
  if (tmpBin) {
    try {
      rmSync(tmpBin, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

async function chat(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });
}

describeIfHostScript("hermes-profile-api attachments + overrides", { timeout: 15000 }, () => {
  it("400 when too many attachments", async () => {
    const res = await chat({
      messages: [{ role: "user", content: "hi" }],
      attachments: [
        { filename: "a.txt", mime: "text/plain", dataBase64: Buffer.from("a").toString("base64") },
        { filename: "b.txt", mime: "text/plain", dataBase64: Buffer.from("b").toString("base64") },
        { filename: "c.txt", mime: "text/plain", dataBase64: Buffer.from("c").toString("base64") },
      ],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("too_many_attachments");
  });

  it("413 when attachments exceed byte cap", async () => {
    const big = Buffer.alloc(2048, 65).toString("base64"); // 2 KB > 1 KB cap
    const res = await chat({
      messages: [{ role: "user", content: "hi" }],
      attachments: [{ filename: "big.bin", mime: "application/octet-stream", dataBase64: big }],
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe("attachments_too_large");
  });

  it("400 on malformed base64", async () => {
    const res = await chat({
      messages: [{ role: "user", content: "hi" }],
      attachments: [{ filename: "x.txt", mime: "text/plain", dataBase64: "abcde" }],
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("bad_attachment");
  });

  it("200 on happy path with image attachment", async () => {
    const res = await chat({
      messages: [{ role: "user", content: "look" }],
      attachments: [{ filename: "tiny.png", mime: "image/png", dataBase64: CONST_PNG_B64 }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.choices?.[0]?.message?.content).toContain("[attachments]");
    expect(body.choices?.[0]?.message?.content).toContain("tiny.png");
    // Per-request tmp dirs are named hermes-chat-p1test-*; all must be gone.
    const leftover = readdirSync(os.tmpdir()).filter((n) => n.startsWith("hermes-chat-p1test-"));
    expect(leftover).toEqual([]);
  });
});
