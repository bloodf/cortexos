// @vitest-environment node
/**
 * W59 — launchers.test.ts
 *
 * Tests for the new `dashboard-launcher` Service kind (migration 009) +
 * the `/apps` page launcher surface. Two sources are tested:
 *
 *   1. **DB path** — PGlite + the real migration runner. Verifies that
 *      009_hermes_webui_boxbox_seed.sql applies cleanly, that the
 *      `services_kind_check` constraint accepts `dashboard-launcher`,
 *      and that `listServices({ kind: 'dashboard-launcher' })` returns
 *      the two seeded rows.
 *
 *   2. **Stub-data path** — the M2/dev in-memory `listDashboardLaunchers()`
 *      function. Verifies the dev seed shape (mirrors migration 009) +
 *      the sort order + the active-only / kind-only filters.
 *
 * This file does NOT test the /apps +page.svelte rendering (that lives
 * in the route's own `+page.test.ts` if/when one is added; the Svelte
 * component is a thin pass-through to the launchers list).
 *
 * Coverage budget: 30+ tests in this file. Coverage of the schema's
 * `services_kind_check` CHECK constraint (the post-009 extended set) is
 * a load-bearing test — it pins the schema invariant that the Drizzle
 * `check()` mirror in `schema.ts:117` must stay in sync with the SQL
 * in `migrations/009_hermes_webui_boxbox_seed.sql`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createTestDb, type PgliteDbClient } from "../../test-utils";
import { listServices, getServiceBySlug, createService } from "../services";
import {
	listDashboardLaunchers,
	_resetStubData,
	_seedDashboardLaunchers,
	createService as stubCreateService,
	updateService as stubUpdateService,
} from "../../../stub-data";

// Resolve repo root from this test file's own location so the
// filesystem-relative paths below don't depend on `process.cwd()`
// (which changes when the test is invoked from the dashboard package
// directory vs the monorepo root).
//
// Path math: this file lives at
//   packages/dashboard/src/lib/server/db/repos/__tests__/launchers.test.ts
// going up 8 levels lands at the repo root.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..", "..", "..", "..");
const DASHBOARD_PKG_ROOT = resolve(REPO_ROOT, "packages/dashboard");

let db: PgliteDbClient;
let client: import("@electric-sql/pglite").PGlite;

beforeEach(async () => {
	const r = await createTestDb();
	db = r.db;
	client = r.client;
	// Stub data is module-level — reset before every test so the dev
	// seeds are deterministic and tests cannot leak into each other.
	_resetStubData();
}, 30_000);

afterEach(async () => {
	if (client) await client.close();
});

// ---------------------------------------------------------------------------
// 1. Migration 009 applies cleanly + the constraint is extended
// ---------------------------------------------------------------------------

describe("migration 009 — schema extension + seed rows", () => {
	it("009_hermes_webui_boxbox_seed.sql exists in the migrations directory", () => {
		const path = join(
			DASHBOARD_PKG_ROOT,
			"migrations/009_hermes_webui_boxbox_seed.sql",
		);
		const content = readFileSync(path, "utf8");
		expect(content).toContain("dashboard-launcher");
		expect(content).toContain("hermes-webui-host");
		expect(content).toContain("boxbox-host");
	});

	it("the services_kind_check constraint accepts 'dashboard-launcher'", async () => {
		// createTestDb runs the full migration set, so 009 has already
		// extended the CHECK. A successful insert proves the constraint
		// is open to the new value.
		const ok = await createService(db, {
			slug: "test-launcher-ok",
			name: "Test Launcher OK",
			kind: "dashboard-launcher",
			category: "Test",
			healthUrl: "http://127.0.0.1:9999/health",
			healthType: "http",
			openUrl: "/test-launcher/",
			iconType: "auto",
			iconColor: null,
			iconImage: null,
			sortOrder: 0,
			isActive: true,
			hasWebui: false,
			showInHealthcheck: true,
			showInWebui: true,
		} as never);
		expect(ok.kind).toBe("dashboard-launcher");
	});

	it("the services_kind_check constraint still rejects unknown kinds", async () => {
		// Bypass the Drizzle typed insert to force a bad value past the
		// type system — the database CHECK is the line of defence.
		await expect(
			db.execute(sql`
				INSERT INTO services (slug, name, kind, category, health_url, health_type, open_url)
				VALUES ('bad-kind', 'Bad', 'unknown-kind', 'Test', '#', 'http', '#')
			`),
		).rejects.toThrow(/services_kind_check|check constraint/i);
	});

	it("the services_kind_check constraint accepts the existing kinds (regression)", async () => {
		// Make sure 009's DROP/ADD CONSTRAINT didn't accidentally drop a
		// value that 001_schema.sql allows.
		for (const kind of ["app", "service", "docker", "process"] as const) {
			const row = await createService(db, {
				slug: `regression-${kind}`,
				name: `Regression ${kind}`,
				kind,
				category: "Test",
				healthUrl: "#",
				healthType: "http",
				openUrl: "#",
				iconType: "auto",
				iconColor: null,
				iconImage: null,
				sortOrder: 0,
				isActive: true,
				hasWebui: true,
				showInHealthcheck: true,
				showInWebui: true,
			} as never);
			expect(row.kind).toBe(kind);
		}
	});
});

// ---------------------------------------------------------------------------
// 2. Seeded rows (Hermes Web UI host + BoxBox host) — shape tests
// ---------------------------------------------------------------------------

describe("seeded dashboard-launcher rows", () => {
	it("Hermes Web UI host row is present with kind=dashboard-launcher", async () => {
		const row = await getServiceBySlug(db, "hermes-webui-host");
		expect(row).toBeDefined();
		expect(row?.kind).toBe("dashboard-launcher");
	});

	it("Hermes Web UI host openUrl is /hermes/ (Caddy reverse-proxy path)", async () => {
		const row = await getServiceBySlug(db, "hermes-webui-host");
		expect(row?.openUrl).toBe("/hermes/");
	});

	it("Hermes Web UI host has has_webui=false (link-out, not in-dashboard)", async () => {
		const row = await getServiceBySlug(db, "hermes-webui-host");
		expect(row?.hasWebui).toBe(false);
	});

	it("Hermes Web UI host health_url is the loopback /health endpoint", async () => {
		const row = await getServiceBySlug(db, "hermes-webui-host");
		expect(row?.healthUrl).toBe("http://127.0.0.1:18787/health");
		expect(row?.healthType).toBe("http");
	});

	it("Hermes Web UI host is active + show_in_healthcheck + show_in_webui", async () => {
		const row = await getServiceBySlug(db, "hermes-webui-host");
		expect(row?.isActive).toBe(true);
		expect(row?.showInHealthcheck).toBe(true);
		expect(row?.showInWebui).toBe(true);
	});

	it("Hermes Web UI host category is 'Operator Interfaces'", async () => {
		const row = await getServiceBySlug(db, "hermes-webui-host");
		expect(row?.category).toBe("Operator Interfaces");
	});

	it("BoxBox host row is present with kind=dashboard-launcher", async () => {
		const row = await getServiceBySlug(db, "boxbox-host");
		expect(row).toBeDefined();
		expect(row?.kind).toBe("dashboard-launcher");
	});

	it("BoxBox host openUrl is /files/ (Caddy basicauth path)", async () => {
		const row = await getServiceBySlug(db, "boxbox-host");
		expect(row?.openUrl).toBe("/files/");
	});

	it("BoxBox host has has_webui=false (link-out, not in-dashboard)", async () => {
		const row = await getServiceBySlug(db, "boxbox-host");
		expect(row?.hasWebui).toBe(false);
	});

	it("BoxBox host health_url is the loopback /health endpoint", async () => {
		const row = await getServiceBySlug(db, "boxbox-host");
		expect(row?.healthUrl).toBe("http://127.0.0.1:8200/health");
		expect(row?.healthType).toBe("http");
	});

	it("BoxBox host is active + show_in_healthcheck + show_in_webui", async () => {
		const row = await getServiceBySlug(db, "boxbox-host");
		expect(row?.isActive).toBe(true);
		expect(row?.showInHealthcheck).toBe(true);
		expect(row?.showInWebui).toBe(true);
	});

	it("BoxBox host category is 'Operator Interfaces'", async () => {
		const row = await getServiceBySlug(db, "boxbox-host");
		expect(row?.category).toBe("Operator Interfaces");
	});

	it("BoxBox host sort_order is one more than Hermes Web UI (sort tie-breaker)", async () => {
		const hermes = await getServiceBySlug(db, "hermes-webui-host");
		const boxbox = await getServiceBySlug(db, "boxbox-host");
		expect(boxbox?.sortOrder).toBe((hermes?.sortOrder ?? 0) + 1);
	});

	it("seed rows include the description referencing the install prompts", async () => {
		const hermes = await getServiceBySlug(db, "hermes-webui-host");
		const boxbox = await getServiceBySlug(db, "boxbox-host");
		expect(hermes?.description).toMatch(/30-hermes-webui\.md/);
		expect(boxbox?.description).toMatch(/30c-boxbox\.md/);
	});
});

// ---------------------------------------------------------------------------
// 2b. Memory OS host (migration 010) — shape tests, mirrors the 009 block
// ---------------------------------------------------------------------------

describe("seeded Memory OS host row (migration 010)", () => {
	it("010_memory_os_seed.sql exists in the migrations directory", () => {
		const path = join(
			DASHBOARD_PKG_ROOT,
			"migrations/010_memory_os_seed.sql",
		);
		const content = readFileSync(path, "utf8");
		expect(content).toContain("memory-os-host");
		expect(content).toContain("dashboard-launcher");
	});

	it("Memory OS host row is present with kind=dashboard-launcher", async () => {
		const row = await getServiceBySlug(db, "memory-os-host");
		expect(row).toBeDefined();
		expect(row?.kind).toBe("dashboard-launcher");
	});

	it("Memory OS host openUrl is /memory/ (Caddy reverse-proxy path)", async () => {
		const row = await getServiceBySlug(db, "memory-os-host");
		expect(row?.openUrl).toBe("/memory/");
	});

	it("Memory OS host has has_webui=false (link-out, not in-dashboard)", async () => {
		const row = await getServiceBySlug(db, "memory-os-host");
		expect(row?.hasWebui).toBe(false);
	});

	it("Memory OS host health_url is the Qdrant /healthz endpoint", async () => {
		const row = await getServiceBySlug(db, "memory-os-host");
		expect(row?.healthUrl).toBe("http://127.0.0.1:6333/healthz");
		expect(row?.healthType).toBe("http");
	});

	it("Memory OS host is active + show_in_healthcheck + show_in_webui", async () => {
		const row = await getServiceBySlug(db, "memory-os-host");
		expect(row?.isActive).toBe(true);
		expect(row?.showInHealthcheck).toBe(true);
		expect(row?.showInWebui).toBe(true);
	});

	it("Memory OS host category is 'Operator Interfaces'", async () => {
		const row = await getServiceBySlug(db, "memory-os-host");
		expect(row?.category).toBe("Operator Interfaces");
	});

	it("Memory OS host sort_order is boxbox.sortOrder + 1 (sort tie-breaker)", async () => {
		const boxbox = await getServiceBySlug(db, "boxbox-host");
		const memoryOs = await getServiceBySlug(db, "memory-os-host");
		expect(memoryOs?.sortOrder).toBe((boxbox?.sortOrder ?? 0) + 1);
	});

	it("seed row description references the install prompt 33-hermes-memory-os.md", async () => {
		const row = await getServiceBySlug(db, "memory-os-host");
		expect(row?.description).toMatch(/33-hermes-memory-os\.md/);
		expect(row?.description).toMatch(/Honcho/);
	});
});

// ---------------------------------------------------------------------------
// 3. listServices kind filter
// ---------------------------------------------------------------------------

describe("listServices({ kind: 'dashboard-launcher' })", () => {
	it("returns the three seeded rows and no others", async () => {
		const res = await listServices(db, { kind: "dashboard-launcher" });
		expect(res.total).toBe(3);
		const slugs = res.rows.map((r) => r.slug).sort();
		expect(slugs).toEqual(["boxbox-host", "hermes-webui-host", "memory-os-host"]);
	});

	it("excludes the original seed (postgresql, caddy, grafana) when kind-filtered", async () => {
		const res = await listServices(db, { kind: "dashboard-launcher" });
		const slugs = res.rows.map((r) => r.slug);
		expect(slugs).not.toContain("postgresql");
		expect(slugs).not.toContain("caddy");
		expect(slugs).not.toContain("grafana");
	});

	it("returns ALL rows when no kind filter is supplied (launchers are not hidden)", async () => {
		const res = await listServices(db, { activeOnly: true });
		const slugs = res.rows.map((r) => r.slug);
		expect(slugs).toContain("hermes-webui-host");
		expect(slugs).toContain("boxbox-host");
		expect(slugs).toContain("memory-os-host");
		expect(slugs).toContain("postgresql");
	});

	it("excludes inactive launchers from the default list (activeOnly=true)", async () => {
		// Flip the Hermes Web UI host row to isActive=false and re-list.
		const existing = await getServiceBySlug(db, "hermes-webui-host");
		expect(existing).toBeDefined();
		await db.execute(sql`UPDATE services SET is_active = false WHERE slug = 'hermes-webui-host'`);
		const res = await listServices(db, { kind: "dashboard-launcher" });
		expect(res.rows.find((r) => r.slug === "hermes-webui-host")).toBeUndefined();
		// Reset for the next test
		await db.execute(sql`UPDATE services SET is_active = true WHERE slug = 'hermes-webui-host'`);
	});

	it("returns the launchers when activeOnly=false even if the row is inactive", async () => {
		await db.execute(sql`UPDATE services SET is_active = false WHERE slug = 'boxbox-host'`);
		const res = await listServices(db, {
			kind: "dashboard-launcher",
			activeOnly: false,
		});
		expect(res.rows.find((r) => r.slug === "boxbox-host")).toBeDefined();
		await db.execute(sql`UPDATE services SET is_active = true WHERE slug = 'boxbox-host'`);
	});

	it("results are paginated (pageSize=1 returns exactly one launcher)", async () => {
		const res = await listServices(db, {
			kind: "dashboard-launcher",
			pageSize: 1,
		});
		expect(res.rows.length).toBe(1);
		expect(res.total).toBe(3);
		// Compute hasMore inline (the repo's PaginatedServices does not
		// expose hasMore — see db/repos/services.ts:58-63).
		const hasMore = res.page * res.pageSize < res.total;
		expect(hasMore).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 4. Stub-data path (M2/dev in-memory listDashboardLaunchers)
// ---------------------------------------------------------------------------

describe("listDashboardLaunchers (stub-data)", () => {
	beforeEach(() => {
		// _resetStubData is called in the outer beforeEach; the module
		// loader does NOT auto-seed the dev launchers on test import
		// (we call it explicitly here for clarity in each test).
		_seedDashboardLaunchers();
	});

	it("returns the three seeded dev launchers", () => {
		const rows = listDashboardLaunchers();
		const slugs = rows.map((r) => r.slug).sort();
		expect(slugs).toEqual(["boxbox-host", "hermes-webui-host", "memory-os-host"]);
	});

	it("returns only rows with kind === 'dashboard-launcher'", () => {
		// Mix in a non-launcher service to verify the kind filter.
		stubCreateService({
			slug: "regular-service",
			name: "Regular",
			kind: "service",
			category: "Test",
			healthUrl: "#",
			healthType: "http",
			openUrl: "#",
			iconType: "auto",
			iconColor: null,
			iconImage: null,
			sortOrder: 0,
			isActive: true,
			hasWebui: true,
			showInHealthcheck: true,
			showInWebui: true,
		});
		const rows = listDashboardLaunchers();
		expect(rows.find((r) => r.slug === "regular-service")).toBeUndefined();
	});

	it("excludes inactive launchers (isActive=false)", () => {
		const hermes = listDashboardLaunchers().find((r) => r.slug === "hermes-webui-host");
		expect(hermes).toBeDefined();
		stubUpdateService(hermes!.id, { isActive: false });
		expect(listDashboardLaunchers().find((r) => r.slug === "hermes-webui-host")).toBeUndefined();
	});

	it("sorts by sortOrder ascending (Hermes Web UI < BoxBox < Memory OS)", () => {
		const rows = listDashboardLaunchers();
		expect(rows[0]?.slug).toBe("hermes-webui-host");
		expect(rows[1]?.slug).toBe("boxbox-host");
		expect(rows[2]?.slug).toBe("memory-os-host");
	});

	it("is idempotent — calling _seedDashboardLaunchers twice does not duplicate rows", () => {
		_seedDashboardLaunchers();
		_seedDashboardLaunchers();
		expect(listDashboardLaunchers().length).toBe(3);
	});

	it("is idempotent after _resetStubData — re-seeding restores the canonical three rows", () => {
		_resetStubData();
		expect(listDashboardLaunchers().length).toBe(0);
		_seedDashboardLaunchers();
		expect(listDashboardLaunchers().length).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// 5. /apps page server load — passes the stub list through unchanged
// ---------------------------------------------------------------------------

describe("/apps +page.server.ts loader", () => {
	it("returns the dashboard-launcher list under the `launchers` key", async () => {
		_seedDashboardLaunchers();
		// The loader is a thin pass-through. Import the file fresh so
		// the load fn closure is captured. The route lives at
		//   src/routes/(authed)/apps/+page.server.ts
		// and the test file is at
		//   src/lib/server/db/repos/__tests__/launchers.test.ts
		// so the relative path is ../../../../routes/(authed)/apps/+page.server
		// (5 levels up: __tests__ → repos → db → server → lib → src, then into routes/...).
		const mod = await import("../../../../../routes/(authed)/apps/+page.server");
		// The load function returns a plain object; call it with a
		// minimal event-shaped arg.
		const fakeEvent = { url: new URL("http://localhost/apps") } as never;
		const res = await mod.load(fakeEvent);
		expect(res).toHaveProperty("launchers");
		expect(Array.isArray(res.launchers)).toBe(true);
		const slugs = (res.launchers as { slug: string }[]).map((r) => r.slug).sort();
		expect(slugs).toEqual(["boxbox-host", "hermes-webui-host", "memory-os-host"]);
	});

	it("returns an empty list when no launchers are seeded (e.g. _resetStubData was called)", async () => {
		_resetStubData();
		const mod = await import("../../../../../routes/(authed)/apps/+page.server");
		const fakeEvent = { url: new URL("http://localhost/apps") } as never;
		const res = await mod.load(fakeEvent);
		expect(res.launchers).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// 6. i18n keys — en, es, pt-br all expose the new 'apps' block
// ---------------------------------------------------------------------------

describe("i18n keys for the /apps page", () => {
	const localeFiles = ["en.json", "es.json", "pt-br.json"] as const;

	for (const file of localeFiles) {
		it(`${file} has the apps.title key`, () => {
			const path = join(
				DASHBOARD_PKG_ROOT,
				`src/lib/i18n/messages/${file}`,
			);
			const json = JSON.parse(readFileSync(path, "utf8")) as {
				apps?: { title?: string; description?: string };
			};
			expect(json.apps?.title).toBeTruthy();
			expect(json.apps?.description).toBeTruthy();
		});

		it(`${file} has the apps.openInNewTab + apps.empty.* keys`, () => {
			const path = join(
				DASHBOARD_PKG_ROOT,
				`src/lib/i18n/messages/${file}`,
			);
			const json = JSON.parse(readFileSync(path, "utf8")) as {
				apps?: {
					openInNewTab?: string;
					noDescription?: string;
					empty?: { title?: string; description?: string };
				};
			};
			expect(json.apps?.openInNewTab).toBeTruthy();
			expect(json.apps?.noDescription).toBeTruthy();
			expect(json.apps?.empty?.title).toBeTruthy();
			expect(json.apps?.empty?.description).toBeTruthy();
		});
	}
});
