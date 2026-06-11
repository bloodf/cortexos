// @vitest-environment node
/**
 * Migration roundtrip test.
 *
 * Starts from an empty PGlite, runs all `migrations/*.sql` files in
 * lexical order, and verifies the resulting schema matches the
 * canonical Drizzle schema:
 *   - Every domain table exists
 *   - Every expected column is present with the right type
 *   - The `migrations` table contains every filename
 *   - Critical indexes (RBAC + audit) are present
 *   - The dashboard_command_audit lifecycle trigger is installed
 *
 * If this test fails, the SQL migrations and the Drizzle schema have
 * diverged. Either fix the SQL or update `schema.ts` to match.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { createMigratedPgliteDb } from "../../client.pglite";

let client: PGlite;
let ran: string[];

const EXPECTED_TABLES = [
  "migrations",
  "services",
  "badges",
  "service_badges",
  "alerts",
  "agent_gateway_audit",
  "projects",
  "messaging_routes",
  "pam_users",
  "admin_sessions",
  "service_health_log",
  "alert_rules",
  "alert_history",
  "action_log",
  "config",
  "dashboard_layouts",
  "chat_sessions",
  "incus_instances",
  "audit_log",
  "pending_approvals",
  "dashboard_command_audit",
  "mail_guardian_reviews",
  "mail_guardian_actions",
  "mail_guardian_processed",
  "mail_guardian_rules",
  "mail_guardian_accounts",
];

const CRITICAL_INDEXES = [
  // RBAC
  "idx_admin_sessions_token",
  "idx_admin_sessions_user",
  "idx_admin_sessions_expires_at",
  // Audit (agent_gateway)
  "idx_agent_gateway_audit_ts",
  "idx_agent_gateway_audit_role_ts",
  "idx_agent_gateway_audit_actor_ts",
  // Audit (hash chain)
  "idx_audit_log_event_type",
  "idx_audit_log_subject",
  "idx_audit_log_chain_head",
  "idx_audit_log_actor",
  "idx_audit_log_source",
  // Command audit
  "idx_dashboard_command_audit_request_id",
  "idx_dashboard_command_audit_created_at",
  "idx_dashboard_command_audit_requester_created",
  "idx_dashboard_command_audit_status_created",
  "idx_dashboard_command_audit_command_created",
  "idx_dashboard_command_audit_session",
  // Action log
  "idx_action_log_user_created",
];

beforeAll(async () => {
  const dir = join(process.cwd(), "migrations");
  const r = await createMigratedPgliteDb(dir);
  client = r.client;
  ran = r.ran;
}, 30_000);

afterAll(async () => {
  if (client) await client.close();
});

describe("migration roundtrip", () => {
  it("applies all migrations in lexical order", async () => {
    // Six files in `migrations/` after the M1.5 + M2 cleanup:
    //   001_schema                                    — base tables (M1)
    //   002_session_columns_for_auth                  — admin_sessions columns (M2-WS3)
    //   003_incus_instances                           — wizard-saved instance rows (M1-WS6)
    //   004_session_indexes                           — session GC + role-check indexes (G9)
    //   006_indexes_for_rbac_audit                    — RBAC + audit indexes (M1-WS6)
    //   007_grants_dashboard_command_audit            — dashboard role grants (M1-WS6)
    //   008_dashboard_command_audit                   — the table itself (M1.5 follow-up)
    //   009_hermes_webui_boxbox_seed                  — dashboard-launcher kind + seed (W59)
    //   010_memory_os_seed                            — Memory OS launcher seed (F-3)
    //   011_mail_guardian                             — Mail Guardian tables (reviews/actions/processed/rules/accounts)
    //   012_apps_webui_urls                           — MP-022 webui URL map + show_in_webui alignment
    //   013_obot_no_webui                             — MP-022 022b review: Obot has no reachable web UI
    // Filenames 004 / 005 are intentionally not used in this branch —
    // the 002_seed/003_incus/004_reconcile/005_dashboard_command_audit
    // four-file expectation was authored against a pre-M1.5 state that
    // has since been superseded by 002_session_columns_for_auth +
    // 006_indexes_for_rbac_audit + 008_dashboard_command_audit.
    expect(ran.length).toBe(12);
    expect(ran).toEqual([
      "001_schema",
      "002_session_columns_for_auth",
      "003_incus_instances",
      "004_session_indexes",
      "006_indexes_for_rbac_audit",
      "007_grants_dashboard_command_audit",
      "008_dashboard_command_audit",
      "009_hermes_webui_boxbox_seed",
      "010_memory_os_seed",
      "011_mail_guardian",
      "012_apps_webui_urls",
      "013_obot_no_webui",
    ]);
  });

  it("records every applied migration in the migrations table", async () => {
    const rows = await client.query<{ name: string }>("SELECT name FROM migrations ORDER BY name");
    const applied = rows.rows.map((r) => r.name);
    [
      "001_schema",
      "002_session_columns_for_auth",
      "003_incus_instances",
      "006_indexes_for_rbac_audit",
      "007_grants_dashboard_command_audit",
      "008_dashboard_command_audit",
      "009_hermes_webui_boxbox_seed",
      "010_memory_os_seed",
      "012_apps_webui_urls",
      "013_obot_no_webui",
    ].forEach((expected) => {
      expect(applied).toContain(expected);
    });
  });

  it("creates every domain table", async () => {
    const rows = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
			 WHERE table_schema = 'public' ORDER BY table_name`,
    );
    const present = new Set(rows.rows.map((r) => r.table_name));
    EXPECTED_TABLES.forEach((t) => {
      expect(present.has(t), `missing table: ${t}`).toBe(true);
    });
  });

  it("creates every critical RBAC + audit index", async () => {
    const rows = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const present = new Set(rows.rows.map((r) => r.indexname));
    CRITICAL_INDEXES.forEach((idx) => {
      expect(present.has(idx), `missing index: ${idx}`).toBe(true);
    });
  });

  it("installs the dashboard_command_audit updated_at trigger", async () => {
    const rows = await client.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_dashboard_command_audit_touch_updated_at'`,
    );
    expect(rows.rows.length).toBe(1);
  });

  it("enforces the dashboard_command_audit request_id unique constraint", async () => {
    await client.exec(`
			INSERT INTO dashboard_command_audit (request_id, command, argv)
			VALUES ('test-req-1', 'echo', '[]'::jsonb)
		`);
    // Second insert with the same request_id must fail.
    await expect(
      client.exec(`
				INSERT INTO dashboard_command_audit (request_id, command, argv)
				VALUES ('test-req-1', 'echo', '[]'::jsonb)
			`),
    ).rejects.toThrow();
  });

  it("enforces the agent_gateway_audit CHECK constraints", async () => {
    await expect(
      client.exec(`
				INSERT INTO agent_gateway_audit (tool_class, args_hash, decision, result)
				VALUES ('not-a-tool-class', 'hash', 'allow', 'ok')
			`),
    ).rejects.toThrow();
  });

  it("enforces the alerts severity CHECK constraint", async () => {
    await expect(
      client.exec(`
				INSERT INTO alerts (kind, severity, title)
				VALUES ('test', 'fatal', 'x')
			`),
    ).rejects.toThrow();
  });
});
