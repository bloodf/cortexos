import { describe, it, expect, beforeEach } from "vitest";
import {
  envelope,
  validate,
  parse,
  schemaFileForType,
  loadSchemas,
  _resetForTesting,
  EnvelopeValidationError,
} from "./index.js";

beforeEach(() => {
  _resetForTesting();
  loadSchemas();
});

const workData = {
  runId: "11111111-2222-4333-8444-555555555555",
  issueId: "ISSUE-1",
  agentId: "agent-1",
  role: "eng-backend",
  wakeReason: "manual",
  payload: { hello: "world" },
};

describe("schemaFileForType", () => {
  it("maps paperclip work/status/approval", () => {
    expect(schemaFileForType("cortex.paperclip.work.eng-backend.v1")).toBe("paperclip-work-v1.json");
    expect(schemaFileForType("cortex.paperclip.status.eng-backend.v1")).toBe("paperclip-status-v1.json");
    expect(schemaFileForType("cortex.paperclip.approval.eng-backend.v1")).toBe("paperclip-approval-v1.json");
  });

  it("maps collapsed top-level namespaces", () => {
    expect(schemaFileForType("cortex.alerts.critical.bridge.v1")).toBe("cortex-alerts-v1.json");
    expect(schemaFileForType("cortex.graph.state.run.v1")).toBe("cortex-graph-state-v1.json");
    expect(schemaFileForType("cortex.signal.approval.run.v1")).toBe("cortex-signal-v1.json");
  });

  it("rejects malformed types", () => {
    expect(() => schemaFileForType("not.cortex.x.y.v1")).toThrow(EnvelopeValidationError);
    expect(() => schemaFileForType("cortex.paperclip.work.eng")).toThrow(EnvelopeValidationError);
    expect(() => schemaFileForType(null)).toThrow(EnvelopeValidationError);
  });
});

describe("envelope()", () => {
  it("produces valid CloudEvents object", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "cortex-paperclip-bridge",
      subject: "ISSUE-1",
      data: workData,
    });
    expect(ev.specversion).toBe("1.0");
    expect(ev.datacontenttype).toBe("application/json");
    expect(ev.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(ev.time).toMatch(/Z$/);
    expect(ev.dataschema).toBe("https://cortexos/schemas/paperclip-work-v1.json");
    expect(() => validate(ev)).not.toThrow();
  });

  it("requires type and source", () => {
    expect(() => envelope({ source: "x", data: {} })).toThrow(EnvelopeValidationError);
    expect(() => envelope({ type: "cortex.paperclip.work.x.v1", data: {} })).toThrow(EnvelopeValidationError);
  });
});

describe("validate()", () => {
  it("accepts valid envelope", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "bridge",
      data: workData,
    });
    expect(validate(ev)).toBe(true);
  });

  it("rejects missing specversion", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "bridge",
      data: workData,
    });
    delete ev.specversion;
    expect(() => validate(ev)).toThrow(/CloudEvents base/);
  });

  it("rejects wrong specversion", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "bridge",
      data: workData,
    });
    ev.specversion = "0.3";
    expect(() => validate(ev)).toThrow(EnvelopeValidationError);
  });

  it("rejects bad time format", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "bridge",
      data: workData,
    });
    ev.time = "not-a-time";
    expect(() => validate(ev)).toThrow(EnvelopeValidationError);
  });

  it("rejects unknown data shape (paperclip-work missing runId)", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "bridge",
      data: { ...workData },
    });
    delete ev.data.runId;
    expect(() => validate(ev)).toThrow(/paperclip-work/);
  });

  it("rejects paperclip-status with bad enum", () => {
    const ev = envelope({
      type: "cortex.paperclip.status.eng-backend.v1",
      source: "consumer",
      data: {
        runId: "11111111-2222-4333-8444-555555555555",
        issueId: "ISSUE-1",
        status: "weird",
        comment: "",
        costUsdCents: 0,
      },
    });
    expect(() => validate(ev)).toThrow(EnvelopeValidationError);
  });

  it("accepts valid alerts payload", () => {
    const ev = envelope({
      type: "cortex.alerts.critical.bridge.v1",
      source: "dashboard",
      data: { severity: "critical", source: "bridge", message: "boom" },
    });
    expect(validate(ev)).toBe(true);
  });
});

describe("parse()", () => {
  it("round-trips a valid envelope from string", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "bridge",
      data: workData,
    });
    const text = JSON.stringify(ev);
    const out = parse(text);
    expect(out.id).toBe(ev.id);
  });

  it("round-trips from Uint8Array", () => {
    const ev = envelope({
      type: "cortex.paperclip.work.eng-backend.v1",
      source: "bridge",
      data: workData,
    });
    const bytes = new TextEncoder().encode(JSON.stringify(ev));
    expect(parse(bytes).id).toBe(ev.id);
  });

  it("rejects invalid JSON", () => {
    expect(() => parse("not json")).toThrow(EnvelopeValidationError);
  });
});

describe("schema lookup coverage", () => {
  it("every shipped schema is reachable via a representative type", () => {
    const cases = [
      ["cortex.paperclip.work.eng-backend.v1", "paperclip-work-v1.json"],
      ["cortex.paperclip.status.eng-backend.v1", "paperclip-status-v1.json"],
      ["cortex.paperclip.approval.eng-backend.v1", "paperclip-approval-v1.json"],
      ["cortex.alerts.info.dash.v1", "cortex-alerts-v1.json"],
      ["cortex.graph.state.run.v1", "cortex-graph-state-v1.json"],
      ["cortex.signal.approval.run.v1", "cortex-signal-v1.json"],
    ];
    for (const [t, f] of cases) expect(schemaFileForType(t)).toBe(f);
  });
});
