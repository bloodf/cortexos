import { describe, it, expect } from "vitest";

const RUN = !!process.env.RUN_INTEGRATION;

describe.skipIf(!RUN)("integration: publish -> consume round trip", () => {
  it("publishes signed envelope and consumes it via JetStream", async () => {
    const { getConnection, publish, verifyEnvelope } = await import("../lib/nats-publisher.js");
    const nc = await getConnection();
    const js = nc.jetstream();
    const jsm = await nc.jetstreamManager();

    const subject = `cortex.paperclip.work.TEST-${Date.now()}`;
    try { await jsm.streams.info("CORTEX"); }
    catch { await jsm.streams.add({ name: "CORTEX", subjects: ["cortex.>", "openclaw.>"] }); }

    const subAck = nc.subscribe(subject, { max: 1 });
    await publish(subject, { hello: "world", ts: Date.now() });
    for await (const m of subAck) {
      const env = JSON.parse(new TextDecoder().decode(m.data));
      expect(verifyEnvelope(env)).toBe(true);
      expect(env.data.hello).toBe("world");
      break;
    }
    await nc.drain();
  });
});
