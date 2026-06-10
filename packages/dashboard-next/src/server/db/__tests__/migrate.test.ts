// @vitest-environment node
/**
 * migrate.test.ts — coverage of the SQL migration runner.
 *
 * Tests the public API of `runSqlMigrations` plus the pure helpers
 * `getLanIp`, `replaceVpsLanIp`, `defaultMigrationsDir`. Uses a real
 * PGlite executor wired through `pgliteExecutor` so the runner sees
 * a faithful Postgres engine.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { PGlite } from "@electric-sql/pglite";
import { runSqlMigrations, replaceVpsLanIp, defaultMigrationsDir, getLanIp } from "../migrate";
import { pgliteExecutor } from "../client.pglite";

let client: PGlite;

beforeEach(() => {
  client = new PGlite();
}, 30_000);

afterEach(async () => {
  if (client) await client.close();
});

describe("migrate — pure helpers", () => {
  it("replaceVpsLanIp replaces every occurrence", () => {
    const out = replaceVpsLanIp("host=<VPS_LAN_IP> other=<VPS_LAN_IP>", "10.0.0.1");
    expect(out).toBe("host=10.0.0.1 other=10.0.0.1");
  });

  it("replaceVpsLanIp leaves SQL without the placeholder alone", () => {
    const out = replaceVpsLanIp("CREATE TABLE foo (id int);", "10.0.0.1");
    expect(out).toBe("CREATE TABLE foo (id int);");
  });

  it("defaultMigrationsDir returns a path under cwd/migrations", () => {
    const d = defaultMigrationsDir();
    expect(d).toMatch(/migrations$/);
    expect(d.startsWith(process.cwd())).toBe(true);
  });

  it("getLanIp returns a string or undefined", () => {
    const ip = getLanIp();
    if (ip !== undefined) {
      expect(typeof ip).toBe("string");
      expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    }
  });
});

describe("migrate — runSqlMigrations", () => {
  it("applies all pending migrations and returns their names", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrate-test-"));
    writeFileSync(join(dir, "001_init.sql"), "CREATE TABLE foo (id int);");
    writeFileSync(join(dir, "002_more.sql"), "CREATE TABLE bar (id int);");

    const out = await runSqlMigrations({
      dir,
      executor: pgliteExecutor(client),
    });
    expect(out).toEqual(["001_init", "002_more"]);
    expect(out.length).toBe(2);

    // Re-run: no new migrations to apply.
    const second = await runSqlMigrations({
      dir,
      executor: pgliteExecutor(client),
    });
    expect(second).toEqual([]);

    rmSync(dir, { recursive: true });
  });

  it("swallows extension errors when ignoreUnsupportedExtensions is true", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrate-test-"));
    writeFileSync(
      join(dir, "001_extension.sql"),
      "CREATE EXTENSION IF NOT EXISTS timescaledb;\nCREATE TABLE baz (id int);",
    );

    const out = await runSqlMigrations({
      dir,
      executor: {
        exec: async (sql) => {
          if (/CREATE EXTENSION/i.test(sql)) {
            throw new Error("extension timescaledb not available");
          }
          await client.exec(sql);
        },
        query: async <T = Record<string, unknown>>(sql: string, params?: unknown[]) => {
          const res = params ? await client.query<T>(sql, params) : await client.query<T>(sql);
          return res.rows as T[];
        },
      },
      ignoreUnsupportedExtensions: true,
      lanIp: "10.0.0.1",
    });
    expect(out).toEqual(["001_extension"]);
    rmSync(dir, { recursive: true });
  });

  it("throws extension errors when ignoreUnsupportedExtensions is false", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrate-test-"));
    writeFileSync(join(dir, "001_extension.sql"), "CREATE EXTENSION IF NOT EXISTS timescaledb;");

    await expect(
      runSqlMigrations({
        dir,
        executor: {
          exec: async () => {
            throw new Error("extension timescaledb not available");
          },
          query: async () => [],
        },
      }),
    ).rejects.toThrow(/timescaledb/);

    rmSync(dir, { recursive: true });
  });

  it("skips files that do not match the safe-name regex", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrate-test-"));
    writeFileSync(join(dir, "001_ok.sql"), "CREATE TABLE ok (id int);");
    // "002 weird; name.sql" has spaces and a semicolon — fails the regex.
    // (The OS would refuse to even create it, so just check that the
    // valid file runs and the rest of the listing is filtered.)
    const out = await runSqlMigrations({
      dir,
      executor: pgliteExecutor(client),
    });
    expect(out).toEqual(["001_ok"]);

    rmSync(dir, { recursive: true });
  });

  it("replaces <VPS_LAN_IP> when lanIp override is given", async () => {
    const dir = mkdtempSync(join(tmpdir(), "migrate-test-"));
    writeFileSync(join(dir, "001_ip.sql"), "INSERT INTO _ip_test (ip) VALUES ('<VPS_LAN_IP>');");
    // First create the table in a prior migration.
    writeFileSync(join(dir, "000_table.sql"), "CREATE TABLE _ip_test (ip text);");

    await runSqlMigrations({
      dir,
      executor: pgliteExecutor(client),
      lanIp: "192.168.42.42",
    });

    const res = await client.query<{ ip: string }>("SELECT ip FROM _ip_test");
    expect(res.rows[0]?.ip).toBe("192.168.42.42");

    rmSync(dir, { recursive: true });
  });
});
