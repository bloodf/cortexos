// Unit tests for the V13 AgentGateway dispatch helper.
//
// Mocks `fetch` to verify URL, headers, body shape and 401-status surfacing.
// The consumer integration (roster gating + DLQ on 401) is exercised in the
// bridge integration suite documented in docs/NATS-CONTRACT.md.

import { test } from "node:test";
import assert from "node:assert/strict";

process.env.AGENTGATEWAY_BASE_URL = "http://127.0.0.1:18800";
process.env.AGENTGATEWAY_BEARER_TOKEN = "test-token";

const { dispatchToAgentGateway } = await import("../consumer.js");

function installFetchMock(handler) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return handler({ url, init });
  };
  return {
    calls,
    restore: () => { globalThis.fetch = original; },
  };
}

test("dispatchToAgentGateway POSTs to /tool/invoke with bearer + expected body", async () => {
  const mock = installFetchMock(() => ({
    ok: true,
    status: 200,
    json: async () => ({ status: "ok", result: { id: "x" } }),
    text: async () => "",
  }));
  try {
    const resp = await dispatchToAgentGateway({
      role: "ENG-BACKEND",
      issueId: "issue-1",
      runId: "run-1",
      agentId: "agent-a",
      invocation: { tool: "create_file", args: { path: "/tmp/x" }, confirmationToken: "ct-123" },
    });
    assert.equal(resp.status, "ok");
    assert.equal(mock.calls.length, 1);
    const { url, init } = mock.calls[0];
    assert.equal(url, "http://127.0.0.1:18800/tool/invoke");
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Authorization"], "Bearer test-token");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["X-Cortex-Run-Id"], "run-1");
    assert.equal(init.headers["X-Cortex-Issue-Id"], "issue-1");
    assert.equal(init.headers["Nats-Msg-Id"], "run-1:create_file");
    const body = JSON.parse(init.body);
    assert.equal(body.tool, "create_file");
    assert.deepEqual(body.args, { path: "/tmp/x" });
    assert.equal(body.runId, "run-1");
    assert.equal(body.agentId, "agent-a");
    assert.equal(body.role, "ENG-BACKEND");
    assert.equal(body.confirmationToken, "ct-123");
  } finally {
    mock.restore();
  }
});

test("dispatchToAgentGateway surfaces 401 as error with status code", async () => {
  const mock = installFetchMock(() => ({
    ok: false,
    status: 401,
    json: async () => ({}),
    text: async () => "unauthorized",
  }));
  try {
    await assert.rejects(
      () => dispatchToAgentGateway({
        role: "ENG-BACKEND",
        issueId: "issue-2",
        runId: "run-2",
        agentId: "agent-b",
        invocation: { tool: "noop", args: {} },
      }),
      (err) => {
        assert.equal(err.status, 401);
        assert.match(err.message, /agentgateway http 401/);
        return true;
      },
    );
  } finally {
    mock.restore();
  }
});

test("dispatchToAgentGateway surfaces 403 as error with status code", async () => {
  const mock = installFetchMock(() => ({
    ok: false,
    status: 403,
    json: async () => ({}),
    text: async () => "forbidden",
  }));
  try {
    await assert.rejects(
      () => dispatchToAgentGateway({
        role: "ENG-BACKEND",
        issueId: "issue-3",
        runId: "run-3",
        agentId: "agent-c",
        invocation: { tool: "noop", args: {} },
      }),
      (err) => {
        assert.equal(err.status, 403);
        return true;
      },
    );
  } finally {
    mock.restore();
  }
});
