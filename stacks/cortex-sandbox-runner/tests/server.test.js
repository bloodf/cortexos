// Server handler tests. The podman spawn target is mocked via the
// EventEmitter-based fake below so the suite runs anywhere — no
// rootless podman, no runsc, no kernel namespaces required.

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Writable } from "node:stream";
import { buildApp } from "../app/server.js";

function fakeSpawn(scriptedExit, scriptedStdout = "ok\n", scriptedStderr = "") {
  return function spawn(_bin, _args, _opts) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = new Writable({ write(_c, _e, cb) { cb(); } });
    child.kill = () => {};
    // Defer to next tick so the caller has a chance to attach listeners.
    setImmediate(() => {
      if (scriptedStdout) child.stdout.emit("data", Buffer.from(scriptedStdout));
      if (scriptedStderr) child.stderr.emit("data", Buffer.from(scriptedStderr));
      setImmediate(() => child.emit("close", scriptedExit, null));
    });
    return child;
  };
}

async function request(app, method, path, { body, headers } = {}) {
  // Minimal in-process driver — avoid binding a real port. Use
  // node's http.Server via app.listen on port 0 then close after.
  const { createServer } = await import("node:http");
  return new Promise((resolve, reject) => {
    const server = createServer(app);
    server.listen(0, "127.0.0.1", async () => {
      try {
        const { port } = server.address();
        const url = `http://127.0.0.1:${port}${path}`;
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", ...(headers || {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        resolve({ status: res.status, text, json });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

test("GET /healthz responds 200", async () => {
  const app = buildApp({ skipAuth: true, spawn: fakeSpawn(0) });
  const r = await request(app, "GET", "/healthz");
  assert.equal(r.status, 200);
  assert.equal(r.json.ok, true);
});

test("POST /exec rejects malformed body", async () => {
  const app = buildApp({ skipAuth: true, spawn: fakeSpawn(0) });
  const r = await request(app, "POST", "/exec", { body: { image: "alpine:3" } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "invalid_request");
});

test("POST /exec rejects unlisted image", async () => {
  const app = buildApp({ skipAuth: true, spawn: fakeSpawn(0) });
  const r = await request(app, "POST", "/exec", {
    body: { image: "ubuntu:24.04", cmd: ["sh"] },
  });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, "policy_rejected");
});

test("POST /exec returns 200 with mocked podman exit", async () => {
  const app = buildApp({ skipAuth: true, spawn: fakeSpawn(0, "hello\n") });
  const r = await request(app, "POST", "/exec", {
    body: { image: "alpine:3", cmd: ["echo", "hello"] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.exitCode, 0);
  assert.equal(r.json.stdout, "hello\n");
});

test("POST /exec propagates non-zero exit", async () => {
  const app = buildApp({ skipAuth: true, spawn: fakeSpawn(2, "", "boom\n") });
  const r = await request(app, "POST", "/exec", {
    body: { image: "alpine:3", cmd: ["sh", "-c", "exit 2"] },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.exitCode, 2);
  assert.equal(r.json.stderr, "boom\n");
});

test("GET /metrics emits prom-text counters", async () => {
  const app = buildApp({ skipAuth: true, spawn: fakeSpawn(0) });
  const r = await request(app, "GET", "/metrics");
  assert.equal(r.status, 200);
  assert.match(r.text, /sandbox_exec_total/);
});
