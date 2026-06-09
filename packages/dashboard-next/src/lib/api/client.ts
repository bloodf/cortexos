/**
 * Frontend API client — RPC facade (WP-04, reworked per ADR-001).
 *
 * Transport = typed `createServerFn` RPC, NOT fetch("/api/...").
 * Each member calls the corresponding server function directly (typed) so
 * TanStack handles the client↔server serialisation — no hand-rolled fetch.
 *
 * Exposes an `api` object with the SAME member names and call shapes as
 * `src/mocks/api.ts` so Wave-2 route WPs can swap their import from
 *   `import { api } from "@/mocks/api"`
 * to
 *   `import { api } from "@/lib/api/client"`
 * without any call-site changes.
 *
 * Wired domains (Wave-1 server fns exist):
 *   services  — WP-10 (listServices, getService, listServiceHealth)
 *
 * TODO domains (server fns not yet implemented — throws "not yet wired"):
 *   system, processes, network, docker, incus, systemd, alerts,
 *   approvals, audit, users, projects, agents, mail, notifications,
 *   envFiles, badges, backups, scheduler, drives
 *
 * See docs/rebuild/ADR-001-server-transport.md for the RPC transport decision.
 * See src/lib/api/README.md for the full swap guide.
 */

// Re-export auth for the Wave-2 shell/login WP.
export * as auth from "./auth";

// Re-export error types so Wave-2 consumers can import from one place.
export type { ApiClientError, ApiErrorCode, ApiErrorEnvelope } from "./http";

// ---------------------------------------------------------------------------
// Shared pagination types (mirrors mocks/api.ts — keep in sync)
// ---------------------------------------------------------------------------

export type SortDir = "asc" | "desc";

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  sortKey?: string | null;
  sortDir?: SortDir;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Import mock row types so adapters can use them and client can type correctly.
// We import type-only — no runtime dependency on the mock data.
// ---------------------------------------------------------------------------
import type {
  Service,
  SystemData,
  ProcessInfo,
  NetworkData,
  DockerContainer,
  DockerImage,
  DockerVolume,
  IncusInstance,
  SystemdUnit,
  AlertRule,
  AlertHistory,
  ApprovalRequest,
  AuditEntry,
  PamUser,
  Project,
  Agent,
  MailReview,
  BackupSnapshot,
  SchedulerJob,
  DriveInfo,
} from "@/mocks/types";

// Re-export these so Wave-2 consumers that used to `import type { X }
// from "@/mocks/types"` can switch to `@/lib/api/client` in one step.
export type {
  Service,
  SystemData,
  ProcessInfo,
  NetworkData,
  DockerContainer,
  DockerImage,
  DockerVolume,
  IncusInstance,
  SystemdUnit,
  AlertRule,
  AlertHistory,
  ApprovalRequest,
  AuditEntry,
  PamUser,
  Project,
  Agent,
  MailReview,
  BackupSnapshot,
  SchedulerJob,
  DriveInfo,
};

// ---------------------------------------------------------------------------
// Wired server-function imports (WP-10 — services domain)
// ---------------------------------------------------------------------------
import {
  listServices as _listServices,
  listServiceHealth as _listServiceHealth,
} from "./services.functions";

import { toServiceRow } from "@/lib/adapters/services";
import type { HealthSnapshotRow } from "@/lib/adapters/services";

// The gate-middleware pattern (defineServerFn + serverFnNoop) means TypeScript
// infers the outer server fn return as `undefined` — the actual type is carried
// by the gate at runtime. Cast through `unknown` at the boundary to recover the
// typed payloads. This is the only place these casts live; call sites are typed.

type ListServicesInput = {
  category?: string;
  kind?: "app" | "service" | "docker" | "process" | "dashboard-launcher";
  status?: string;
  activeOnly?: boolean;
  page?: number;
  pageSize?: number;
};
type ListServicesOutput = { rows: import("@cortexos/contracts/entities").Service[]; total: number };
type ServiceHealthInput = { id: number; limit?: number };
type ServiceHealthOutput = { snapshots: Array<{ id: string; serviceId: number; status: string; latencyMs: number | null; checkedAt: string; note: string | null }> };

const listServicesFn = _listServices as unknown as (opts: { data: ListServicesInput }) => Promise<ListServicesOutput>;
const listServiceHealthFn = _listServiceHealth as unknown as (opts: { data: ServiceHealthInput }) => Promise<ServiceHealthOutput>;

// Re-export the raw typed server fns for Wave-2 direct use.
export const listServices = _listServices;
export const listServiceHealth = _listServiceHealth;
export type { HealthSnapshotRow };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Typed stub for domains whose server fns are not yet implemented (Wave-1). */
function notYetWired(domain: string): never {
  throw new Error(
    `[WP-04 TODO] api.${domain} — server function not yet wired (Wave-1 WP pending)`,
  );
}

/** Return a typed empty ListResult for domains without a backend yet. */
function emptyList<T>(p: ListParams = {}): ListResult<T> {
  return { rows: [], total: 0, page: p.page ?? 0, pageSize: p.pageSize ?? 25 };
}

/**
 * Apply client-side pagination/sorting to an already-filtered array.
 * Used when the server fn returns a full array without server-side pagination.
 */
function clientSideList<T>(rows: T[], p: ListParams = {}): ListResult<T> {
  const pageSize = Math.max(1, p.pageSize ?? 25);
  const page = Math.max(0, p.page ?? 0);
  const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
  return { rows: slice, total: rows.length, page, pageSize };
}

// ---------------------------------------------------------------------------
// API surface — mirrors mocks/api.ts exactly
// ---------------------------------------------------------------------------

export const api = {
  // ── System / host metrics ──────────────────────────────────────────────
  /**
   * TODO WP-14: system server fn not yet implemented.
   * @see docs/rebuild/STATUS.md WP-14
   */
  system: (): Promise<SystemData> =>
    Promise.reject(notYetWired("system")),

  /**
   * TODO WP-14: processes server fn not yet implemented.
   */
  processes: (): Promise<ProcessInfo[]> =>
    Promise.reject(notYetWired("processes")),

  /**
   * TODO WP-14: network server fn not yet implemented.
   */
  network: (): Promise<NetworkData> =>
    Promise.reject(notYetWired("network")),

  // ── Services (WIRED — WP-10) ───────────────────────────────────────────
  /**
   * Returns all active services as a flat array.
   * Calls listServices RPC → maps contract rows → mock Service shape.
   */
  services: async (): Promise<Service[]> => {
    const { rows } = await listServicesFn({ data: { activeOnly: true, pageSize: 500 } });
    return rows.map(toServiceRow);
  },

  /**
   * Paginated services list (WIRED — WP-10).
   */
  servicesList: async (p?: ListParams): Promise<ListResult<Service>> => {
    const page = (p?.page ?? 0) + 1; // contract is 1-based, mock is 0-based
    const pageSize = p?.pageSize ?? 25;
    const result = await listServicesFn({
      data: {
        page,
        pageSize,
        ...(p?.q ? { category: p.q } : {}),
      },
    });
    return {
      rows: result.rows.map(toServiceRow),
      total: result.total,
      page: p?.page ?? 0,
      pageSize,
    };
  },

  /**
   * Service health snapshots — returns empty until Wave-2 provides a serviceId.
   * The mock `history()` returns a flat array with no service filter; the real
   * `listServiceHealth` requires a specific id. Wave-2 components that need
   * per-service history should call `listServiceHealth` directly.
   */
  history: (): Promise<HealthSnapshotRow[]> => Promise.resolve([]),

  /**
   * Paginated healthcheck view — services with activeOnly=true (WIRED — WP-10).
   */
  healthcheckList: async (p?: ListParams): Promise<ListResult<Service>> => {
    const page = (p?.page ?? 0) + 1;
    const pageSize = p?.pageSize ?? 25;
    const result = await listServicesFn({
      data: {
        activeOnly: true,
        page,
        pageSize,
      },
    });
    const rows = result.rows.map(toServiceRow);
    // Apply q filter client-side (contract does not support freetext q)
    const q = (p?.q ?? "").trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q),
        )
      : rows;
    return {
      rows: filtered,
      total: result.total,
      page: p?.page ?? 0,
      pageSize,
    };
  },

  // ── Docker ────────────────────────────────────────────────────────────
  /**
   * TODO WP-11: docker server fns not yet implemented.
   */
  docker: {
    containers: (): Promise<DockerContainer[]> =>
      Promise.reject(notYetWired("docker.containers")),
    images: (): Promise<DockerImage[]> =>
      Promise.reject(notYetWired("docker.images")),
    volumes: (): Promise<DockerVolume[]> =>
      Promise.reject(notYetWired("docker.volumes")),
    containersList: (_p?: ListParams): Promise<ListResult<DockerContainer>> =>
      Promise.reject(notYetWired("docker.containersList")),
    imagesList: (_p?: ListParams): Promise<ListResult<DockerImage>> =>
      Promise.reject(notYetWired("docker.imagesList")),
    volumesList: (_p?: ListParams): Promise<ListResult<DockerVolume>> =>
      Promise.reject(notYetWired("docker.volumesList")),
  },

  // ── Incus ──────────────────────────────────────────────────────────────
  /**
   * TODO WP-12: incus server fns not yet implemented.
   */
  incus: (): Promise<IncusInstance[]> =>
    Promise.reject(notYetWired("incus")),

  incusList: (_p?: ListParams): Promise<ListResult<IncusInstance>> =>
    Promise.reject(notYetWired("incusList")),

  // ── Systemd ────────────────────────────────────────────────────────────
  /**
   * TODO WP-13: systemd server fns not yet implemented.
   */
  systemd: (): Promise<SystemdUnit[]> =>
    Promise.reject(notYetWired("systemd")),

  systemdList: (_p?: ListParams): Promise<ListResult<SystemdUnit>> =>
    Promise.reject(notYetWired("systemdList")),

  // ── Alerts ────────────────────────────────────────────────────────────
  /**
   * TODO WP-17: alerts server fns not yet implemented.
   */
  alerts: {
    rules: (): Promise<AlertRule[]> =>
      Promise.reject(notYetWired("alerts.rules")),
    history: (): Promise<AlertHistory[]> =>
      Promise.reject(notYetWired("alerts.history")),
    rulesList: (_p?: ListParams): Promise<ListResult<AlertRule>> =>
      Promise.reject(notYetWired("alerts.rulesList")),
    historyList: (_p?: ListParams): Promise<ListResult<AlertHistory>> =>
      Promise.reject(notYetWired("alerts.historyList")),
  },

  // ── Approvals ──────────────────────────────────────────────────────────
  /**
   * TODO WP-16: approvals server fns not yet implemented.
   */
  approvals: (): Promise<ApprovalRequest[]> =>
    Promise.reject(notYetWired("approvals")),

  // ── Audit ──────────────────────────────────────────────────────────────
  /**
   * TODO WP-16: audit server fns not yet implemented.
   */
  audit: (): Promise<AuditEntry[]> =>
    Promise.reject(notYetWired("audit")),

  auditList: (_p?: ListParams): Promise<ListResult<AuditEntry>> =>
    Promise.reject(notYetWired("auditList")),

  // ── Users ──────────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no users server fn in contract scope yet.
   */
  users: (): Promise<PamUser[]> => Promise.resolve([]),

  usersList: (p?: ListParams): Promise<ListResult<PamUser>> =>
    Promise.resolve(emptyList<PamUser>(p)),

  // ── Projects ──────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no projects server fn in contract scope yet.
   */
  projects: (): Promise<Project[]> => Promise.resolve([]),

  projectsList: (p?: ListParams): Promise<ListResult<Project>> =>
    Promise.resolve(emptyList<Project>(p)),

  // ── Agents ────────────────────────────────────────────────────────────
  /**
   * TODO WP-21: agents server fns not yet implemented.
   */
  agents: (): Promise<Agent[]> =>
    Promise.reject(notYetWired("agents")),

  // ── Mail-Guardian ─────────────────────────────────────────────────────
  /**
   * TODO WP-15: mail-guardian server fns not yet implemented.
   */
  mail: (): Promise<MailReview[]> =>
    Promise.reject(notYetWired("mail")),

  mailList: (_p?: ListParams): Promise<ListResult<MailReview>> =>
    Promise.reject(notYetWired("mailList")),

  // ── Notifications ──────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: notifications reserved in contract; no server fn yet.
   */
  notifications: (): Promise<unknown[]> => Promise.resolve([]),

  // ── Env browser ────────────────────────────────────────────────────────
  /**
   * TODO WP-18: env-browser server fns not yet implemented.
   */
  envFiles: (): Promise<unknown[]> =>
    Promise.reject(notYetWired("envFiles")),

  // ── Badges ────────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: badges are embedded in Service entities; no standalone server fn.
   */
  badges: (): Promise<unknown[]> => Promise.resolve([]),

  badgesList: (p?: ListParams): Promise<ListResult<unknown>> =>
    Promise.resolve(emptyList<unknown>(p)),

  // ── Backups ────────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no backups server fn in contract scope yet.
   */
  backups: (): Promise<BackupSnapshot[]> => Promise.resolve([]),

  backupsList: (p?: ListParams): Promise<ListResult<BackupSnapshot>> =>
    Promise.resolve(emptyList<BackupSnapshot>(p)),

  // ── Scheduler ──────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no scheduler server fn in contract scope yet.
   */
  scheduler: (): Promise<SchedulerJob[]> => Promise.resolve([]),

  schedulerList: (p?: ListParams): Promise<ListResult<SchedulerJob>> =>
    Promise.resolve(emptyList<SchedulerJob>(p)),

  // ── Drives (from system payload) ───────────────────────────────────────
  /**
   * TODO WP-14: drives/storage server fn not yet implemented.
   */
  drivesList: (_p?: ListParams): Promise<ListResult<DriveInfo>> =>
    Promise.reject(notYetWired("drivesList")),
} as const;

// listServices, listServiceHealth, and HealthSnapshotRow are already exported
// above via `export const` / `export type` declarations.
