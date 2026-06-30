// @vitest-environment node
/**
 * Audit repository tests.
 *
 * Covers:
 *   - audit_log hash-chain verification
 *   - audit_log append (chain tip advances)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { runSequentially } from "@/lib/sequential";
import { createTestDb, type PgliteDbClient } from "../../test-utils";
import { verifyAuditLogChain, appendAuditLog, jcs } from "../audit";

let db: PgliteDbClient;
let client: PGlite;

beforeEach(async () => {
  const r = await createTestDb({ seed: true });
  db = r.db;
  client = r.client;
}, 30_000);

afterEach(async () => {
  if (client) await client.close();
});

describe("audit repo — audit_log hash chain", () => {
  it("jcs produces deterministic output regardless of key order", () => {
    const a = jcs({ b: 2, a: 1 });
    const b = jcs({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("verifyAuditLogChain on an empty table is valid (count 0)", async () => {
    const res = await verifyAuditLogChain(db);
    expect(res.valid).toBe(true);
    expect(res.count).toBe(0);
  });

  it("appendAuditLog + verifyAuditLogChain — single row chain is valid", async () => {
    await appendAuditLog(db, {
      eventType: "test.event",
      source: "test",
      payload: { a: 1, b: 2 },
    });
    const res = await verifyAuditLogChain(db);
    expect(res.valid).toBe(true);
    expect(res.count).toBe(1);
  });

  it("appendAuditLog + verifyAuditLogChain — multiple rows chain correctly", async () => {
    await runSequentially([0, 1, 2, 3, 4], async (i) =>
      appendAuditLog(db, {
        eventType: `test.event.${i}`,
        source: "test",
        payload: { i },
      }),
    );
    const res = await verifyAuditLogChain(db);
    expect(res.valid).toBe(true);
    expect(res.count).toBe(5);
  });

  it("verifyAuditLogChain detects a tampered payload", async () => {
    await appendAuditLog(db, {
      eventType: "test.event",
      source: "test",
      payload: { a: 1 },
    });
    // Tamper with the row directly (simulating a compromised DB)
    // Bypass the repo and use raw SQL.
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`UPDATE audit_log SET payload = '{"a": 999}'::jsonb`);
    const res = await verifyAuditLogChain(db);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.brokenAt.reason).toBe("payload_hash_mismatch");
    }
  });

  it("verifyAuditLogChain detects a tampered prev_hash", async () => {
    await appendAuditLog(db, {
      eventType: "test.event",
      source: "test",
      payload: { a: 1 },
    });
    await appendAuditLog(db, {
      eventType: "test.event",
      source: "test",
      payload: { a: 2 },
    });
    const { sql } = await import("drizzle-orm");
    await db.execute(
      sql`UPDATE audit_log SET prev_hash = '0000000000000000000000000000000000000000000000000000000000000000' WHERE id = (SELECT id FROM audit_log ORDER BY id OFFSET 1 LIMIT 1)`,
    );
    const res = await verifyAuditLogChain(db);
    expect(res.valid).toBe(false);
    if (!res.valid) {
      expect(res.brokenAt.reason).toBe("prev_hash_mismatch");
    }
  });

  it("appendAuditLog advances the chain tip with correct prev_hash", async () => {
    await appendAuditLog(db, {
      eventType: "test.event",
      source: "test",
      payload: { a: 1 },
    });
    await appendAuditLog(db, {
      eventType: "test.event",
      source: "test",
      payload: { a: 2 },
    });
    const { auditLog } = await import("../../schema");
    const rows = await db.select().from(auditLog).orderBy(auditLog.id);
    // Second row's prev_hash must equal first row's chain_hash.
    const tip1Hash = rows[0].chainHash;
    const row2Prev = rows[1].prevHash;
    expect(row2Prev).toBe(tip1Hash);
  });
});
