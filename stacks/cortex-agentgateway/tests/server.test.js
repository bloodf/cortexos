// Happy-path tests for cortex-agentgateway. Uses a stub publisher and
// auditAppend to avoid any real NATS / Postgres dependency.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "../index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, "../config/tools.json");
const BEARER = "test-bearer-token";

function buildApp(overrides = {}) {
  const published = [];
  const audited = [];
  const app = createApp({
    configPath: CONFIG_PATH,
    publisher: async (subject, payload) => {
      published.push({ subject, payload });
    },
    auditAppend: async (event) => {
      audited.push(event);
    },
    executor: async ({ tool, args }) => ({ tool, echoed: args ?? null }),
    ...overrides,
  });
  return { app, published, audited };
}

describe("cortex-agentgateway HTTP surface", () => {
  beforeEach(() => {
    process.env.AGENTGATEWAY_BEARER_TOKEN = BEARER;
  });
  afterEach(() => {
    delete process.env.AGENTGATEWAY_BEARER_TOKEN;
  });

  it("GET /health returns 200 without auth", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("cortex-agentgateway");
    expect(typeof res.body.ts).toBe("string");
  });

  it("POST /tool/invoke without bearer returns 401", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/tool/invoke")
      .send({
        tool: "propose_role",
        args: { description: "x" },
        runId: "run-1",
        agentId: "agent-1",
        role: "factory_agent",
      });
    expect(res.status).toBe(401);
  });

  it("POST /tool/invoke with bearer + safe tool returns 200 and emits audit", async () => {
    const { app, published, audited } = buildApp();
    const res = await request(app)
      .post("/tool/invoke")
      .set("Authorization", `Bearer ${BEARER}`)
      .send({
        tool: "propose_role",
        args: { description: "summarizer" },
        runId: "run-2",
        agentId: "agent-2",
        role: "factory_agent",
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.toolClass).toBe("safe");
    expect(res.body.result).toEqual({
      tool: "propose_role",
      echoed: { description: "summarizer" },
    });
    expect(published).toHaveLength(1);
    expect(published[0].subject).toBe("cortex.audit.agentgateway.tool-invoke.v1");
    expect(published[0].payload.type).toBe("cortex.audit.agentgateway.tool-invoke.v1");
    expect(audited).toHaveLength(1);
    expect(audited[0].type).toBe("cortex.audit.agentgateway.tool-invoke.v1");
    expect(audited[0].source).toBe("cortexos://cortex-agentgateway");
    expect(audited[0].data).toMatchObject({
      runId: "run-2",
      agentId: "agent-2",
      role: "factory_agent",
      tool: "propose_role",
      toolClass: "safe",
    });
  });

  it("POST /tool/invoke for destructive tool without confirmationToken returns 403", async () => {
    const { app, published } = buildApp();
    const res = await request(app)
      .post("/tool/invoke")
      .set("Authorization", `Bearer ${BEARER}`)
      .send({
        tool: "service_restart",
        args: { service_name: "nats" },
        runId: "run-3",
        agentId: "agent-3",
        role: "cortex",
      });
    expect(res.status).toBe(403);
    expect(res.body.allowed).toBe(false);
    expect(res.body.reason).toMatch(/confirmationToken/);
    expect(published).toHaveLength(0);
  });

  it("POST /tool/invoke for destructive tool with confirmationToken returns 200", async () => {
    const { app, published } = buildApp();
    const res = await request(app)
      .post("/tool/invoke")
      .set("Authorization", `Bearer ${BEARER}`)
      .send({
        tool: "service_restart",
        args: { service_name: "nats", confirmation_slug: "restart-nats" },
        runId: "run-4",
        agentId: "agent-4",
        role: "cortex",
        confirmationToken: "operator-ack-abc",
      });
    expect(res.status).toBe(200);
    expect(res.body.toolClass).toBe("destructive");
    expect(published).toHaveLength(1);
  });

  it("POST /tool/invoke with unknown tool returns 403", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/tool/invoke")
      .set("Authorization", `Bearer ${BEARER}`)
      .send({
        tool: "does_not_exist",
        runId: "run-5",
        agentId: "agent-5",
        role: "cortex",
      });
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("unknown tool");
  });
});
