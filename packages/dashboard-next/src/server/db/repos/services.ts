/**
 * Services catalog repository.
 *
 * Read-mostly surface; admin-only writes. The list endpoint supports
 * pagination, filter (category, kind, status, is_active), and sort
 * (multiple columns). The default sort is `(category, sort_order, name)`
 * which matches the existing UI expectation.
 *
 * RBAC: reads are public to any authenticated user (the services
 * catalog drives the main dashboard). Writes are admin-gated at the
 * SvelteKit call site — the repo does not enforce it.
 */

import { and, asc, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import type { DbClient } from "../client";
import { services } from "../schema";
import type { NewService, Service } from "../schema";

export type ServiceKind = "app" | "service" | "docker" | "process" | "dashboard-launcher";
export type HealthType = "http" | "tcp" | "docker" | "process" | "systemd";

/**
 * Whitelist of sortable columns. Map public (snake_case) sortBy names
 * to Drizzle column references. This keeps the dynamic lookup safe
 * (no string-based property access on the table) and the public API
 * contract clear.
 */
const SORTABLE_COLUMNS = {
  slug: services.slug,
  name: services.name,
  category: services.category,
  sort_order: services.sortOrder,
  status: services.status,
  updated_at: services.updatedAt,
} as const;

export interface ListServicesOptions {
  /** Only active services (default: true — UI-facing reads). */
  activeOnly?: boolean;
  /** Page (1-indexed). */
  page?: number;
  /** Page size. */
  pageSize?: number;
  /** Free-text search across slug + name + description. */
  search?: string;
  /** Filter by category (exact match). */
  category?: string;
  /** Filter by kind. */
  kind?: ServiceKind;
  /** Filter by health status. */
  status?: string;
  /** Sort column. Default: 'sort_order'. */
  sortBy?: "slug" | "name" | "category" | "sort_order" | "status" | "updated_at";
  /** Sort direction. Default: 'asc'. */
  sortDir?: "asc" | "desc";
}

export interface PaginatedServices {
  rows: Service[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

export async function listServices(
  db: DbClient,
  opts: ListServicesOptions = {},
): Promise<PaginatedServices> {
  const activeOnly = opts.activeOnly ?? true;
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, opts.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const conds: SQL[] = [];
  if (activeOnly) conds.push(eq(services.isActive, true));
  if (opts.category) conds.push(eq(services.category, opts.category));
  if (opts.kind) conds.push(eq(services.kind, opts.kind));
  if (opts.status) conds.push(eq(services.status, opts.status));
  if (opts.search) {
    const likeTerm = `%${opts.search}%`;
    conds.push(
      or(
        like(services.slug, likeTerm),
        like(services.name, likeTerm),
        like(services.description, likeTerm),
      )!,
    );
  }
  const where = conds.length > 0 ? and(...conds) : undefined;

  const sortBy = opts.sortBy ?? "sort_order";
  const sortDir = opts.sortDir ?? "asc";
  const sortColumn = SORTABLE_COLUMNS[sortBy];
  const order = sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(services)
      .where(where)
      .orderBy(order, asc(services.name))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(services)
      .where(where),
  ]);

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize,
  };
}

export async function getServiceById(db: DbClient, id: number): Promise<Service | null> {
  const rows = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getServiceBySlug(db: DbClient, slug: string): Promise<Service | null> {
  const rows = await db.select().from(services).where(eq(services.slug, slug)).limit(1);
  return rows[0] ?? null;
}

export async function listCategories(
  db: DbClient,
  opts: { activeOnly?: boolean } = {},
): Promise<string[]> {
  const where = opts.activeOnly !== false ? eq(services.isActive, true) : undefined;
  const rows = await db
    .selectDistinct({ category: services.category })
    .from(services)
    .where(where)
    .orderBy(asc(services.category));
  return rows.map((r) => r.category);
}

export async function createService(db: DbClient, input: NewService): Promise<Service> {
  const inserted = await db.insert(services).values(input).returning();
  const row = inserted[0];
  if (!row) throw new Error("Failed to create service");
  return row;
}

const UPDATABLE_COLUMNS = [
  "slug",
  "name",
  "kind",
  "category",
  "description",
  "healthUrl",
  "healthType",
  "openUrl",
  "envSource",
  "status",
  "lastCheckAt",
  "responseMs",
  "uptime24h",
  "iconType",
  "iconColor",
  "iconImage",
  "sortOrder",
  "isActive",
  "hasWebui",
  "showInHealthcheck",
  "showInWebui",
] as const;

/**
 * Partial update. The caller supplies only the fields they want to
 * change; `updatedAt` is always set to NOW(). Unknown fields are
 * silently ignored (matches the existing pg `ALLOWED_COLUMNS` guard).
 */
export async function updateService(
  db: DbClient,
  id: number,
  patch: Partial<Omit<Service, "id" | "createdAt" | "updatedAt">>,
): Promise<Service | null> {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of UPDATABLE_COLUMNS) {
    if (key in patch && (patch as Record<string, unknown>)[key] !== undefined) {
      update[key] = (patch as Record<string, unknown>)[key];
    }
  }
  if (Object.keys(update).length === 1) {
    // Only updatedAt — caller passed no real fields. Return current row.
    return getServiceById(db, id);
  }
  const res = await db.update(services).set(update).where(eq(services.id, id)).returning();
  return res[0] ?? null;
}

export async function deleteService(db: DbClient, id: number): Promise<boolean> {
  const res = await db.delete(services).where(eq(services.id, id)).returning({ id: services.id });
  return res.length > 0;
}
