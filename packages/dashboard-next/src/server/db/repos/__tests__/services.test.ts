// @vitest-environment node
/**
 * Services repository tests.
 *
 * Covers: list (with pagination, filter, sort, search), get by id/slug,
 * category list, create, partial update, delete.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, type PgliteDbClient } from "../../test-utils";
import {
  listServices,
  getServiceById,
  getServiceBySlug,
  listCategories,
  createService,
  updateService,
  deleteService,
} from "../services";

let db: PgliteDbClient;
let client: PGlite;

beforeEach(async () => {
  const r = await createTestDb();
  db = r.db;
  client = r.client;
}, 30_000);

afterEach(async () => {
  if (client) await client.close();
});

describe("services repo", () => {
  it("listServices returns the seeded catalog", async () => {
    const result = await listServices(db, { activeOnly: true });
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.rows.find((s) => s.slug === "postgresql")).toBeDefined();
  });

  it("listServices filters by hasWebui=true", async () => {
    await createService(db, {
      slug: "no-webui-svc",
      name: "No Web UI",
      kind: "service",
      category: "Test",
      healthUrl: "#",
      healthType: "http",
      openUrl: "#",
      iconType: "auto",
      iconColor: null,
      iconImage: null,
      sortOrder: 99,
      isActive: true,
      hasWebui: false,
      showInHealthcheck: false,
      showInWebui: false,
    });
    const result = await listServices(db, { hasWebui: true, activeOnly: false });
    expect(result.rows.every((s) => s.hasWebui === true)).toBe(true);
    expect(result.rows.find((s) => s.slug === "no-webui-svc")).toBeUndefined();
    expect(result.rows.find((s) => s.slug === "grafana")).toBeDefined();
  });

  it("listServices excludes inactive services by default", async () => {
    await createService(db, {
      slug: "hidden",
      name: "Hidden",
      kind: "service",
      category: "Test",
      healthUrl: "#",
      healthType: "http",
      openUrl: "#",
      iconType: "auto",
      iconColor: null,
      iconImage: null,
      sortOrder: 99,
      isActive: false,
      hasWebui: false,
      showInHealthcheck: false,
      showInWebui: false,
    });
    const active = await listServices(db, { activeOnly: true });
    const all = await listServices(db, { activeOnly: false });
    expect(active.rows.find((s) => s.slug === "hidden")).toBeUndefined();
    expect(all.rows.find((s) => s.slug === "hidden")).toBeDefined();
  });

  it("listServices paginates", async () => {
    const page1 = await listServices(db, { page: 1, pageSize: 1 });
    const page2 = await listServices(db, { page: 2, pageSize: 1 });
    expect(page1.rows.length).toBe(1);
    expect(page2.rows.length).toBe(1);
    expect(page1.rows[0].id).not.toBe(page2.rows[0].id);
  });

  it("listServices filters by category", async () => {
    const result = await listServices(db, { category: "Database" });
    expect(result.rows.every((s) => s.category === "Database")).toBe(true);
  });

  it("listServices searches by name", async () => {
    const result = await listServices(db, { search: "grafana" });
    expect(result.rows.find((s) => s.slug === "grafana")).toBeDefined();
  });

  it("listServices sorts by name desc", async () => {
    const result = await listServices(db, { sortBy: "name", sortDir: "desc" });
    const names = result.rows.map((s) => s.name);
    const sorted = [...names].sort().reverse();
    expect(names).toEqual(sorted);
  });

  it("getServiceById returns the row", async () => {
    const result = await listServices(db, { activeOnly: true, pageSize: 1 });
    const first = result.rows[0];
    const got = await getServiceById(db, first.id);
    expect(got?.id).toBe(first.id);
  });

  it("getServiceBySlug returns the row", async () => {
    const got = await getServiceBySlug(db, "postgresql");
    expect(got?.name).toBe("PostgreSQL");
  });

  it("listCategories returns distinct categories", async () => {
    const cats = await listCategories(db);
    expect(cats).toContain("Database");
    expect(cats).toContain("Monitoring");
  });

  it("createService inserts and returns the row", async () => {
    const s = await createService(db, {
      slug: "test-svc",
      name: "Test",
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
    expect(s.slug).toBe("test-svc");
  });

  it("updateService updates only the specified fields", async () => {
    const created = await createService(db, {
      slug: "upd-svc",
      name: "Upd",
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
    const updated = await updateService(db, created.id, { name: "Upd2" });
    expect(updated?.name).toBe("Upd2");
    expect(updated?.slug).toBe("upd-svc"); // unchanged
  });

  it("updateService ignores unknown fields", async () => {
    const created = await createService(db, {
      slug: "ignore-svc",
      name: "Ignore",
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
    const updated = await updateService(db, created.id, { notAColumn: "x" } as never);
    expect(updated?.name).toBe("Ignore");
  });

  it("deleteService removes the row", async () => {
    const created = await createService(db, {
      slug: "del-svc",
      name: "Del",
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
    expect(await deleteService(db, created.id)).toBe(true);
    expect(await getServiceById(db, created.id)).toBeNull();
  });
});
