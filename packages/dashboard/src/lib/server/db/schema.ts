/**
 * Drizzle schema for the CortexOS dashboard.
 *
 * Mirrors the SQL migrations in `migrations/001..007` exactly. The Drizzle
 * definitions are the canonical TypeScript surface for the SvelteKit data
 * layer; the SQL files are the canonical DDL. The `migrate.ts` runner
 * applies the SQL files in lexical order — the Drizzle schema is read-only
 * for migrations.
 *
 * Two tables of note:
 *   - `agentGatewayAudit` (table: agent_gateway_audit) is **append-only**.
 *     The `dashboard` DB role has INSERT,SELECT but REVOKE UPDATE,DELETE,
 *     TRUNCATE. This is enforced at deploy time, not at the Drizzle level
 *     — we do NOT export UPDATE/DELETE helpers for it.
 *   - `dashboardCommandAudit` is a two-phase lifecycle table: INSERT with
 *     status='created' before dispatch, UPDATE to fill in completion fields
 *     after the root helper returns. Not append-only.
 *
 * Drizzle does not ship an `inet` column type, so we use `customType` with
 * a string column underneath. All other column types are first-class Drizzle.
 *
 * For `audit_log` (TimescaleDB hypertable) we use a plain `pgTable` — the
 * hypertable conversion happens via `create_hypertable()` in 001_schema.sql.
 * Drizzle queries work against the hypertable normally.
 */

import {
	pgTable,
	serial,
	bigserial,
	text,
	varchar,
	integer,
	bigint,
	boolean,
	timestamp,
	numeric,
	jsonb,
	uniqueIndex,
	index,
	primaryKey,
	check,
	customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Custom Postgres `INET` type. Stored as text on the wire (pg returns it as
 * a string); the column type is `inet` server-side. Drizzle reads/writes the
 * raw string.
 */
const inet = customType<{ data: string; driverData: string }>({
	dataType() {
		return "inet";
	},
});

/**
 * Custom Postgres `UUID` type. Stored as native uuid server-side; Drizzle
 * exposes it as a string.
 */
const uuid = customType<{ data: string; driverData: string }>({
	dataType() {
		return "uuid";
	},
});

// =====================================================================
// Migrations meta (the migrations table itself, not a domain table)
// =====================================================================

export const migrationsTable = pgTable("migrations", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 255 }).notNull().unique(),
	appliedAt: timestamp("applied_at", { withTimezone: false }).defaultNow(),
});

export type Migration = typeof migrationsTable.$inferSelect;
export type NewMigration = typeof migrationsTable.$inferInsert;

// =====================================================================
// Services catalog
// =====================================================================

export const services = pgTable(
	"services",
	{
		id: serial("id").primaryKey(),
		slug: varchar("slug", { length: 64 }).notNull().unique(),
		name: varchar("name", { length: 128 }).notNull(),
		kind: varchar("kind", { length: 32 }).notNull().default("service"),
		category: varchar("category", { length: 64 }).notNull(),
		description: text("description"),
		healthUrl: varchar("health_url", { length: 512 }).notNull().default("#"),
		healthType: varchar("health_type", { length: 16 }).notNull().default("http"),
		openUrl: varchar("open_url", { length: 512 }).notNull().default("#"),
		envSource: text("env_source"),
		status: varchar("status", { length: 16 }).notNull().default("unknown"),
		lastCheckAt: timestamp("last_check_at", { withTimezone: false }),
		responseMs: integer("response_ms"),
		uptime24h: numeric("uptime_24h", { precision: 5, scale: 2 }),
		iconType: varchar("icon_type", { length: 32 }).default("auto"),
		iconColor: varchar("icon_color", { length: 7 }),
		iconImage: text("icon_image"),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		hasWebui: boolean("has_webui").notNull().default(true),
		showInHealthcheck: boolean("show_in_healthcheck").notNull().default(true),
		showInWebui: boolean("show_in_webui").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_services_kind_status").on(t.kind, t.status),
		index("idx_services_category").on(t.category),
		index("idx_services_active").on(t.isActive),
		check("services_kind_check", sql`${t.kind} IN ('app','service','docker','process','dashboard-launcher')`),
	],
);

export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;

// =====================================================================
// Badges (catalog + service↔badge join)
// =====================================================================

export const badges = pgTable(
	"badges",
	{
		id: serial("id").primaryKey(),
		slug: varchar("slug", { length: 64 }).notNull().unique(),
		label: varchar("label", { length: 64 }).notNull(),
		color: varchar("color", { length: 7 }).notNull().default("#1f2937"),
		textColor: varchar("text_color", { length: 7 }).notNull().default("#ffffff"),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
	},
);

export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;

export const serviceBadges = pgTable(
	"service_badges",
	{
		serviceId: integer("service_id")
			.notNull()
			.references(() => services.id, { onDelete: "cascade" }),
		badgeId: integer("badge_id")
			.notNull()
			.references(() => badges.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.serviceId, t.badgeId] }),
		index("idx_service_badges_badge").on(t.badgeId),
	],
);

export type ServiceBadge = typeof serviceBadges.$inferSelect;
export type NewServiceBadge = typeof serviceBadges.$inferInsert;

// =====================================================================
// Operational alerts (distinct from rule-based alert_history)
// =====================================================================

export const alerts = pgTable(
	"alerts",
	{
		id: serial("id").primaryKey(),
		kind: varchar("kind", { length: 64 }).notNull(),
		severity: varchar("severity", { length: 16 }).notNull(),
		title: varchar("title", { length: 255 }).notNull(),
		body: text("body"),
		source: varchar("source", { length: 128 }),
		acknowledgedAt: timestamp("acknowledged_at", { withTimezone: false }),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_alerts_unread").on(t.createdAt.desc()).where(sql`${t.acknowledgedAt} IS NULL`),
		index("idx_alerts_severity").on(t.severity, t.createdAt.desc()),
		check("alerts_severity_check", sql`${t.severity} IN ('info','warn','error','critical')`),
	],
);

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

// =====================================================================
// Agent gateway audit (APPEND-ONLY by DB role grants)
// =====================================================================

export const agentGatewayAudit = pgTable(
	"agent_gateway_audit",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		ts: timestamp("ts", { withTimezone: false }).notNull().defaultNow(),
		actorUserId: integer("actor_user_id"),
		sessionId: varchar("session_id", { length: 128 }),
		requestId: varchar("request_id", { length: 128 }),
		role: varchar("role", { length: 128 }),
		account: varchar("account", { length: 128 }),
		tool: varchar("tool", { length: 255 }),
		toolClass: varchar("tool_class", { length: 16 }).notNull(),
		argsHash: text("args_hash").notNull(),
		approvalId: varchar("approval_id", { length: 128 }),
		nonce: varchar("nonce", { length: 128 }),
		policyVersion: integer("policy_version"),
		decision: varchar("decision", { length: 16 }).notNull(),
		decisionReason: text("decision_reason"),
		beforeStateHash: text("before_state_hash"),
		afterStateHash: text("after_state_hash"),
		latencyMs: integer("latency_ms"),
		result: varchar("result", { length: 16 }).notNull(),
	},
	(t) => [
		index("idx_agent_gateway_audit_ts").on(t.ts.desc()),
		index("idx_agent_gateway_audit_role_ts").on(t.role, t.ts.desc()),
		index("idx_agent_gateway_audit_actor_ts").on(t.actorUserId, t.ts.desc()),
		index("idx_agent_gateway_audit_request_id").on(t.requestId),
		check(
			"agent_gateway_audit_tool_class_check",
			sql`${t.toolClass} IN ('safe','privileged','destructive')`,
		),
		check(
			"agent_gateway_audit_decision_check",
			sql`${t.decision} IN ('allow','deny','prompt')`,
		),
		check(
			"agent_gateway_audit_result_check",
			sql`${t.result} IN ('ok','err','timeout','denied')`,
		),
	],
);

export type AgentGatewayAuditRow = typeof agentGatewayAudit.$inferSelect;
export type NewAgentGatewayAuditRow = typeof agentGatewayAudit.$inferInsert;

// =====================================================================
// Projects
// =====================================================================

export const projects = pgTable(
	"projects",
	{
		id: serial("id").primaryKey(),
		slug: varchar("slug", { length: 64 }).notNull().unique(),
		name: varchar("name", { length: 255 }).notNull(),
		repoUrl: varchar("repo_url", { length: 512 }),
		primaryPmAccount: varchar("primary_pm_account", { length: 128 }),
		messagingMode: varchar("messaging_mode", { length: 16 }).notNull().default("single"),
		settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		check("projects_messaging_mode_check", sql`${t.messagingMode} IN ('single','distributed')`),
	],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

// =====================================================================
// Messaging routes
// =====================================================================

export const messagingRoutes = pgTable(
	"messaging_routes",
	{
		id: serial("id").primaryKey(),
		projectId: integer("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		platform: varchar("platform", { length: 16 }).notNull(),
		accountRef: varchar("account_ref", { length: 128 }).notNull(),
		routeConfig: jsonb("route_config").notNull().default(sql`'{}'::jsonb`),
		approvalGates: text("approval_gates").array().notNull().default(sql`ARRAY[]::TEXT[]`),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_messaging_routes_project").on(t.projectId),
		index("idx_messaging_routes_platform").on(t.platform),
		check(
			"messaging_routes_platform_check",
			sql`${t.platform} IN ('telegram','slack','discord','whatsapp','signal','sms','email','matrix','mattermost','teams','line','viber','wechat','webhook')`,
		),
	],
);

export type MessagingRoute = typeof messagingRoutes.$inferSelect;
export type NewMessagingRoute = typeof messagingRoutes.$inferInsert;

// =====================================================================
// PAM users + admin sessions (RBAC core)
// =====================================================================

export const pamUsers = pgTable("pam_users", {
	id: serial("id").primaryKey(),
	username: varchar("username", { length: 64 }).notNull().unique(),
	createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

export type PamUser = typeof pamUsers.$inferSelect;
export type NewPamUser = typeof pamUsers.$inferInsert;

export const adminSessions = pgTable(
	"admin_sessions",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id")
			.notNull()
			.references(() => pamUsers.id, { onDelete: "cascade" }),
		// 32-byte CSPRNG, base64url. 255 was sized for a 32-byte hex; widened
		// to text in 002_session_columns_for_auth.sql so future tokens
		// (UUIDv7, etc.) are not artificially constrained.
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at", { withTimezone: false }).notNull(),
		// Per-session CSRF token (THREAT_MODEL SR-004). The double-submit
		// cookie pattern means the client also has a copy in a non-HttpOnly
		// cookie; the server-side value is the source of truth.
		csrfToken: text("csrf_token"),
		// Source IP (best-effort, X-Forwarded-For aware). Nullable so the
		// column is safe to backfill; do NOT use IP as the sole auth signal
		// (THREAT_MODEL T-001) — it's stored for forensic reconstruction.
		ip: text("ip"),
		// User-Agent snapshot. Same posture as IP.
		userAgent: text("user_agent"),
		// Last time the role (is_admin) was re-validated against the OS
		// group set. The SvelteKit hook re-checks when this is older than
		// 60s (ROLE_CHECK_TTL_MS) so a demoted admin loses the role
		// within one minute (SR-011, SR-012).
		lastRoleCheckAt: bigint("last_role_check_at", { mode: "number" })
			.notNull()
			.default(0),
		// Rolling-expiry clock. Every authenticated request extends
		// expires_at to now + 30d, capped at created_at + 30d. Idempotent
		// with the created_at column for legacy sessions (touched_at
		// backfilled in 002_*.sql).
		touchedAt: timestamp("touched_at", { withTimezone: false }),
		isAdmin: boolean("is_admin").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_admin_sessions_token").on(t.token),
		index("idx_admin_sessions_user").on(t.userId),
		// Added in 006_indexes_for_rbac_audit.sql: listActiveSessions + retention
		// both do `WHERE expires_at > NOW()` (or `<=` for cleanup), which
		// benefits from a plain index on expires_at.
		index("idx_admin_sessions_expires_at").on(t.expiresAt),
		// Added in 002_session_columns_for_auth.sql: rolling-expiry
		// sweep + "my active sessions" listing.
		index("idx_admin_sessions_touched_at").on(t.touchedAt),
		index("idx_admin_sessions_user_touched").on(t.userId, t.touchedAt),
	],
);

export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;

// =====================================================================
// Service health log (30-day retention, swept by lib/socket-server.ts)
// =====================================================================

export const serviceHealthLog = pgTable(
	"service_health_log",
	{
		id: serial("id").primaryKey(),
		serviceId: integer("service_id")
			.notNull()
			.references(() => services.id, { onDelete: "cascade" }),
		status: varchar("status", { length: 16 }).notNull().default("unknown"),
		responseTimeMs: integer("response_time_ms"),
		checkedAt: timestamp("checked_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_service_health_log_service_id").on(t.serviceId),
		index("idx_service_health_log_checked_at").on(t.checkedAt),
		index("idx_service_health_log_checked_at_retention").on(t.checkedAt),
	],
);

export type ServiceHealthLog = typeof serviceHealthLog.$inferSelect;
export type NewServiceHealthLog = typeof serviceHealthLog.$inferInsert;

// =====================================================================
// Alert rules (rule-based) + history
// =====================================================================

export const alertRules = pgTable(
	"alert_rules",
	{
		id: serial("id").primaryKey(),
		serviceId: integer("service_id")
			.notNull()
			.references(() => services.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		condition: varchar("condition", { length: 32 }).notNull(),
		thresholdMs: integer("threshold_ms"),
		enabled: boolean("enabled").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_alert_rules_service_id").on(t.serviceId),
		index("idx_alert_rules_enabled").on(t.enabled),
		check(
			"alert_rules_condition_check",
			sql`${t.condition} IN ('offline','online','response_time')`,
		),
	],
);

export type AlertRule = typeof alertRules.$inferSelect;
export type NewAlertRule = typeof alertRules.$inferInsert;

export const alertHistory = pgTable(
	"alert_history",
	{
		id: serial("id").primaryKey(),
		ruleId: integer("rule_id")
			.notNull()
			.references(() => alertRules.id, { onDelete: "cascade" }),
		serviceId: integer("service_id")
			.notNull()
			.references(() => services.id, { onDelete: "cascade" }),
		status: varchar("status", { length: 16 }).notNull(),
		message: text("message").notNull(),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_alert_history_rule_id").on(t.ruleId),
		index("idx_alert_history_service_id").on(t.serviceId),
		index("idx_alert_history_created_at").on(t.createdAt),
		index("idx_alert_history_created_at_retention").on(t.createdAt),
	],
);

export type AlertHistoryRow = typeof alertHistory.$inferSelect;
export type NewAlertHistoryRow = typeof alertHistory.$inferInsert;

// =====================================================================
// Action log (UI-initiated docker/systemd/etc. mutations)
// =====================================================================

export const actionLog = pgTable(
	"action_log",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id"),
		username: varchar("username", { length: 255 }),
		targetType: varchar("target_type", { length: 32 }).notNull(),
		targetName: varchar("target_name", { length: 255 }).notNull(),
		action: varchar("action", { length: 32 }).notNull(),
		status: varchar("status", { length: 16 }).notNull(),
		message: text("message"),
		createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_action_log_created_at").on(t.createdAt.desc()),
		index("idx_action_log_target").on(t.targetType, t.targetName),
		index("idx_action_log_status").on(t.status),
		// Added in 006_indexes_for_rbac_audit.sql: per-user action history.
		index("idx_action_log_user_created").on(t.userId, t.createdAt.desc()),
		check(
			"action_log_target_type_check",
			sql`${t.targetType} IN ('docker','systemd','updates','local-user','mail-guardian','incus')`,
		),
		check("action_log_status_check", sql`${t.status} IN ('success','failure')`),
	],
);

export type ActionLogEntry = typeof actionLog.$inferSelect;
export type NewActionLogEntry = typeof actionLog.$inferInsert;

// =====================================================================
// Key/value config
// =====================================================================

export const config = pgTable("config", {
	key: varchar("key", { length: 128 }).primaryKey(),
	value: text("value").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export type ConfigEntry = typeof config.$inferSelect;
export type NewConfigEntry = typeof config.$inferInsert;

// =====================================================================
// Dashboard layouts (per user; F-1 says USE this, not localStorage)
// =====================================================================

export const dashboardLayouts = pgTable(
	"dashboard_layouts",
	{
		id: serial("id").primaryKey(),
		userId: integer("user_id").notNull().default(1),
		layout: jsonb("layout").notNull().default(sql`'{"rows":[]}'::jsonb`),
		updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
	},
	(t) => [uniqueIndex("idx_dashboard_layouts_user").on(t.userId)],
);

export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;

// =====================================================================
// Chat sessions (per-user; H-6 size cap + TTL)
// =====================================================================

export const chatSessions = pgTable("chat_sessions", {
	userId: integer("user_id")
		.primaryKey()
		.references(() => pamUsers.id, { onDelete: "cascade" }),
	panelOpen: boolean("panel_open").notNull().default(false),
	width: integer("width").notNull().default(360),
	messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
	expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().default(sql`NOW() + INTERVAL '30 days'`),
	updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;

// =====================================================================
// Incus instances (wizard-saved configs + lifecycle)
// =====================================================================

export const incusInstances = pgTable(
	"incus_instances",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		name: text("name").notNull().unique(),
		slug: text("slug"),
		status: text("status").notNull().default("draft"),
		config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
		lastValidation: jsonb("last_validation"),
		lastRequestId: uuid("last_request_id"),
		createdBy: text("created_by"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		index("idx_incus_instances_status").on(t.status),
		index("idx_incus_instances_slug").on(t.slug),
		check(
			"incus_instances_status_check",
			sql`${t.status} IN ('draft','validated','provisioning','active','failed')`,
		),
	],
);

export type IncusInstance = typeof incusInstances.$inferSelect;
export type NewIncusInstance = typeof incusInstances.$inferInsert;

// =====================================================================
// Hash-chained audit hypertable (TimescaleDB)
// =====================================================================

export const auditLog = pgTable(
	"audit_log",
	{
		id: bigserial("id", { mode: "number" }).notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
		eventId: uuid("event_id").notNull(),
		eventType: text("event_type").notNull(),
		source: text("source").notNull(),
		subject: text("subject"),
		actor: text("actor"),
		payloadHash: text("payload_hash").notNull(),
		prevHash: text("prev_hash").notNull(),
		chainHash: text("chain_hash").notNull(),
		rekorLogIndex: bigint("rekor_log_index", { mode: "number" }),
		payload: jsonb("payload").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.occurredAt, t.id] }),
		index("idx_audit_log_event_type").on(t.eventType, t.occurredAt.desc()),
		index("idx_audit_log_subject").on(t.subject, t.occurredAt.desc()),
		index("idx_audit_log_chain_head").on(t.occurredAt.desc(), t.id.desc()),
		// Added in 006_indexes_for_rbac_audit.sql: per-actor history.
		index("idx_audit_log_actor").on(t.actor, t.occurredAt.desc()),
		// Added in 006_indexes_for_rbac_audit.sql: per-source history.
		index("idx_audit_log_source").on(t.source, t.occurredAt.desc()),
	],
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

// =====================================================================
// Pending approvals queue
// =====================================================================

export const pendingApprovals = pgTable("pending_approvals", {
	id: bigserial("id", { mode: "number" }).primaryKey(),
	runId: text("run_id").notNull(),
	signalName: text("signal_name").notNull(),
	// The remaining columns are the bare minimum we know from the
	// 001_schema.sql migration (which was truncated in the audit). The
	// migration is the source of truth; the repo is responsible for any
	// additional fields via raw SQL or Drizzle inserts.
	createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
});

export type PendingApproval = typeof pendingApprovals.$inferSelect;
export type NewPendingApproval = typeof pendingApprovals.$inferInsert;

// =====================================================================
// Dashboard command audit (TWO-PHASE LIFECYCLE — not append-only)
// =====================================================================

export const dashboardCommandAudit = pgTable(
	"dashboard_command_audit",
	{
		id: bigserial("id", { mode: "number" }).primaryKey(),
		// Request identity
		requestId: text("request_id").notNull().unique(),
		requestedBy: text("requested_by").notNull().default("trusted-dashboard"),
		sourceIp: inet("source_ip"),
		sourceUserAgent: text("source_user_agent"),
		dashboardSessionId: text("dashboard_session_id"),
		// Command spec
		command: text("command").notNull(),
		argv: jsonb("argv").notNull().default(sql`'[]'::jsonb`),
		cwd: text("cwd"),
		envAllowlist: jsonb("env_allowlist")
			.notNull()
			.default(sql`'{"names": []}'::jsonb`),
		stdinSha256: text("stdin_sha256"),
		timeoutMs: integer("timeout_ms"),
		approvedPolicy: text("approved_policy").notNull().default("trusted-lan-tailnet"),
		mutationClass: text("mutation_class").notNull().default("unknown"),
		targetScope: text("target_scope").notNull().default("host"),
		dryRun: boolean("dry_run").notNull().default(false),
		// Lifecycle
		status: text("status").notNull().default("created"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
		stdoutSha256: text("stdout_sha256"),
		stderrSha256: text("stderr_sha256"),
		stdoutBytes: integer("stdout_bytes").notNull().default(0),
		stderrBytes: integer("stderr_bytes").notNull().default(0),
		exitCode: integer("exit_code"),
		signal: text("signal"),
		error: text("error"),
		journaldCursor: text("journald_cursor"),
		// Free-form
		metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [
		// request_id is the UPDATE WHERE-key + socket protocol identifier.
		// UNIQUE is also defined in the schema declaration; the explicit
		// index here keeps the name aligned with the SQL migration.
		uniqueIndex("idx_dashboard_command_audit_request_id").on(t.requestId),
		index("idx_dashboard_command_audit_created_at").on(t.createdAt.desc()),
		index("idx_dashboard_command_audit_requester_created").on(
			t.requestedBy,
			t.createdAt.desc(),
		),
		index("idx_dashboard_command_audit_status_created").on(t.status, t.createdAt.desc()),
		index("idx_dashboard_command_audit_command_created").on(t.command, t.createdAt.desc()),
		// Added in 006_indexes_for_rbac_audit.sql: per-session history.
		index("idx_dashboard_command_audit_session").on(t.dashboardSessionId, t.createdAt.desc()),
	],
);

export type DashboardCommandAudit = typeof dashboardCommandAudit.$inferSelect;
export type NewDashboardCommandAudit = typeof dashboardCommandAudit.$inferInsert;

// =====================================================================
// Schema export — useful for tools that want to introspect every table
// =====================================================================

export const schema = {
	migrations: migrationsTable,
	services,
	badges,
	serviceBadges,
	alerts,
	agentGatewayAudit,
	projects,
	messagingRoutes,
	pamUsers,
	adminSessions,
	serviceHealthLog,
	alertRules,
	alertHistory,
	actionLog,
	config,
	dashboardLayouts,
	chatSessions,
	incusInstances,
	auditLog,
	pendingApprovals,
	dashboardCommandAudit,
};
