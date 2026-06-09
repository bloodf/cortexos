/**
 * Frontend API client.
 *
 * Exposes an `api` object with the SAME member names and call shapes as
 * `src/mocks/api.ts` so Wave-2 route WPs can swap their import from
 *   `import { api } from "@/mocks/api"`
 * to
 *   `import { api } from "@/lib/api/client"`
 * without any call-site changes.
 *
 * Where the contract's output shape differs from the mock's expected shape
 * (e.g. `{rows,total}` vs bare array) the normalisation happens here — call
 * sites never see the difference.
 *
 * Endpoints without a Wave-1 backend return real empty results.
 * NEVER return fabricated / seed data from this file.
 *
 * See src/lib/api/README.md for the full swap guide.
 */
import { request } from "./http";
import * as auth from "./auth";

// Re-export auth for the Wave-2 shell/login WP.
export { auth };

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
// Internal helpers
// ---------------------------------------------------------------------------

/** Map ListParams to the query object understood by the API. */
function toListQuery(
  p: ListParams = {},
): Record<string, string | number | boolean | null | undefined> {
  return {
    q: p.q,
    page: p.page,
    pageSize: p.pageSize,
    sortKey: p.sortKey ?? undefined,
    sortDir: p.sortDir,
  };
}

/**
 * Normalize a `{rows,total,page,pageSize}` response.
 * The contract's paginated responses always have this shape; the mock returns
 * the same shape via `listFrom`.
 */
function normList<T>(
  raw: { rows: T[]; total: number; page?: number; pageSize?: number },
  p: ListParams = {},
): ListResult<T> {
  return {
    rows: raw.rows,
    total: raw.total,
    page: raw.page ?? p.page ?? 0,
    pageSize: raw.pageSize ?? p.pageSize ?? 25,
  };
}

/** Return a typed empty ListResult for endpoints without a backend yet. */
function emptyList<T>(p: ListParams = {}): ListResult<T> {
  return { rows: [], total: 0, page: p.page ?? 0, pageSize: p.pageSize ?? 25 };
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

// We also re-export these so Wave-2 consumers that used to `import type { X }
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
// API surface — mirrors mocks/api.ts exactly
// ---------------------------------------------------------------------------

export const api = {
  // ── System / host metrics ──────────────────────────────────────────────
  /** GET /api/system — returns the full system snapshot. */
  system: (): Promise<SystemData> =>
    request<SystemData>("GET", "/api/system"),

  /** GET /api/processes — returns the process list. */
  processes: (): Promise<ProcessInfo[]> =>
    request<{ processes: ProcessInfo[] }>("GET", "/api/processes").then(
      (r) => r.processes,
    ),

  /** GET /api/network — returns network interface data. */
  network: (): Promise<NetworkData> =>
    request<NetworkData>("GET", "/api/network"),

  // ── Services ──────────────────────────────────────────────────────────
  /**
   * GET /api/services — returns all active services as a flat array.
   * The contract returns `{rows,total}`; we unwrap to match the mock shape.
   */
  services: (): Promise<Service[]> =>
    request<{ rows: Service[]; total: number }>("GET", "/api/services").then(
      (r) => r.rows,
    ),

  /** GET /api/services (paginated) */
  servicesList: (p?: ListParams): Promise<ListResult<Service>> =>
    request<{ rows: Service[]; total: number; page: number; pageSize: number }>(
      "GET",
      "/api/services",
      { query: toListQuery(p) },
    ).then((r) => normList(r, p)),

  /**
   * GET /api/services/:id/health — history snapshots.
   * The mock exposes `history()` returning a flat array.
   */
  history: (): Promise<unknown[]> =>
    request<{ snapshots: unknown[] }>("GET", "/api/services/health-history").then(
      (r) => r.snapshots ?? [],
    ),

  /** Paginated healthcheck view — same data source as services. */
  healthcheckList: (p?: ListParams): Promise<ListResult<Service>> =>
    request<{ rows: Service[]; total: number; page: number; pageSize: number }>(
      "GET",
      "/api/services",
      { query: { ...toListQuery(p), activeOnly: true } },
    ).then((r) => normList(r, p)),

  // ── Docker ────────────────────────────────────────────────────────────
  docker: {
    /** GET /api/docker/containers */
    containers: (): Promise<DockerContainer[]> =>
      request<{ items: DockerContainer[] }>("GET", "/api/docker/containers").then(
        (r) => r.items,
      ),

    /** GET /api/docker/images */
    images: (): Promise<DockerImage[]> =>
      request<{ items: DockerImage[] }>("GET", "/api/docker/images").then(
        (r) => r.items,
      ),

    /** GET /api/docker/volumes */
    volumes: (): Promise<DockerVolume[]> =>
      request<{ items: DockerVolume[] }>("GET", "/api/docker/volumes").then(
        (r) => r.items,
      ),

    /** Paginated containers list. */
    containersList: (p?: ListParams): Promise<ListResult<DockerContainer>> =>
      request<{ items: DockerContainer[] }>("GET", "/api/docker/containers").then(
        (r) => {
          const rows = r.items;
          const q = (p?.q ?? "").trim().toLowerCase();
          const filtered = q
            ? rows.filter(
                (c) =>
                  c.name.toLowerCase().includes(q) ||
                  c.image.toLowerCase().includes(q) ||
                  c.status.toLowerCase().includes(q) ||
                  c.state.toLowerCase().includes(q),
              )
            : rows;
          return clientSideList(filtered, p);
        },
      ),

    /** Paginated images list. */
    imagesList: (p?: ListParams): Promise<ListResult<DockerImage>> =>
      request<{ items: DockerImage[] }>("GET", "/api/docker/images").then(
        (r) => {
          const rows = r.items;
          const q = (p?.q ?? "").trim().toLowerCase();
          const filtered = q
            ? rows.filter(
                (i) =>
                  i.repo.toLowerCase().includes(q) ||
                  i.tag.toLowerCase().includes(q) ||
                  i.id.toLowerCase().includes(q),
              )
            : rows;
          return clientSideList(filtered, p);
        },
      ),

    /** Paginated volumes list. */
    volumesList: (p?: ListParams): Promise<ListResult<DockerVolume>> =>
      request<{ items: DockerVolume[] }>("GET", "/api/docker/volumes").then(
        (r) => {
          const rows = r.items;
          const q = (p?.q ?? "").trim().toLowerCase();
          const filtered = q
            ? rows.filter(
                (v) =>
                  v.name.toLowerCase().includes(q) ||
                  v.driver.toLowerCase().includes(q) ||
                  v.mountpoint.toLowerCase().includes(q),
              )
            : rows;
          return clientSideList(filtered, p);
        },
      ),
  },

  // ── Incus ──────────────────────────────────────────────────────────────
  /** GET /api/incus/instances — returns flat array. */
  incus: (): Promise<IncusInstance[]> =>
    request<{ items: IncusInstance[] }>("GET", "/api/incus/instances").then(
      (r) => r.items,
    ),

  /** Paginated incus instances list. */
  incusList: (p?: ListParams): Promise<ListResult<IncusInstance>> =>
    request<{ items: IncusInstance[] }>("GET", "/api/incus/instances").then(
      (r) => {
        const rows = r.items;
        const q = (p?.q ?? "").trim().toLowerCase();
        const filtered = q
          ? rows.filter(
              (i) =>
                i.name.toLowerCase().includes(q) ||
                i.image.toLowerCase().includes(q) ||
                i.status.toLowerCase().includes(q),
            )
          : rows;
        return clientSideList(filtered, p);
      },
    ),

  // ── Systemd ────────────────────────────────────────────────────────────
  /** GET /api/systemd — returns flat array (via /api/system or dedicated). */
  systemd: (): Promise<SystemdUnit[]> =>
    request<{ items: SystemdUnit[] }>("GET", "/api/systemd/units").then(
      (r) => r.items ?? [],
    ),

  /** Paginated systemd units list. */
  systemdList: (p?: ListParams): Promise<ListResult<SystemdUnit>> =>
    request<{ items: SystemdUnit[] }>("GET", "/api/systemd/units").then(
      (r) => {
        const rows = r.items ?? [];
        const q = (p?.q ?? "").trim().toLowerCase();
        const filtered = q
          ? rows.filter(
              (u) =>
                u.name.toLowerCase().includes(q) ||
                u.description.toLowerCase().includes(q) ||
                u.active.toLowerCase().includes(q),
            )
          : rows;
        return clientSideList(filtered, p);
      },
    ),

  // ── Alerts ────────────────────────────────────────────────────────────
  alerts: {
    /** GET /api/alerts — returns alert rules. */
    rules: (): Promise<AlertRule[]> =>
      request<{ alerts: AlertRule[] }>("GET", "/api/alerts").then(
        (r) => r.alerts ?? [],
      ),

    /** GET /api/alerts/history — returns alert history. */
    history: (): Promise<AlertHistory[]> =>
      request<{ history: AlertHistory[] }>("GET", "/api/alerts/history").then(
        (r) => r.history ?? [],
      ),

    /** Paginated alert rules list. */
    rulesList: (p?: ListParams): Promise<ListResult<AlertRule>> =>
      request<{ alerts: AlertRule[] }>("GET", "/api/alerts").then(
        (r) => {
          const rows = r.alerts ?? [];
          const q = (p?.q ?? "").trim().toLowerCase();
          const filtered = q
            ? rows.filter(
                (a) =>
                  a.name.toLowerCase().includes(q) ||
                  a.condition.toLowerCase().includes(q),
              )
            : rows;
          return clientSideList(filtered, p);
        },
      ),

    /** Paginated alert history list. */
    historyList: (p?: ListParams): Promise<ListResult<AlertHistory>> =>
      request<{ history: AlertHistory[] }>("GET", "/api/alerts/history").then(
        (r) => {
          const rows = r.history ?? [];
          const q = (p?.q ?? "").trim().toLowerCase();
          const filtered = q
            ? rows.filter(
                (h) =>
                  (h.ruleName ?? "").toLowerCase().includes(q) ||
                  (h.serviceName ?? "").toLowerCase().includes(q) ||
                  h.status.toLowerCase().includes(q),
              )
            : rows;
          return clientSideList(filtered, p);
        },
      ),
  },

  // ── Approvals ──────────────────────────────────────────────────────────
  /** GET /api/approvals — returns pending approvals. */
  approvals: (): Promise<ApprovalRequest[]> =>
    request<{ pending: ApprovalRequest[] }>("GET", "/api/approvals").then(
      (r) => r.pending ?? [],
    ),

  // ── Audit ──────────────────────────────────────────────────────────────
  /** GET /api/audit — returns audit events. */
  audit: (): Promise<AuditEntry[]> =>
    request<{ events: AuditEntry[] }>("GET", "/api/audit").then(
      (r) => r.events ?? [],
    ),

  /** Paginated audit log list. */
  auditList: (p?: ListParams): Promise<ListResult<AuditEntry>> =>
    request<{ events: AuditEntry[]; total?: number }>(
      "GET",
      "/api/audit",
      { query: toListQuery(p) },
    ).then(
      (r) => {
        const rows = r.events ?? [];
        const q = (p?.q ?? "").trim().toLowerCase();
        const filtered = q
          ? rows.filter(
              (e) =>
                e.actor.toLowerCase().includes(q) ||
                e.tool.toLowerCase().includes(q) ||
                (e.decision_reason ?? "").toLowerCase().includes(q),
            )
          : rows;
        if (r.total !== undefined) {
          return normList({ rows: filtered, total: r.total }, p);
        }
        return clientSideList(filtered, p);
      },
    ),

  // ── Users ──────────────────────────────────────────────────────────────
  /**
   * Users are not in the API contract yet — return empty until a backend
   * domain (admin/users) is added.
   * EMPTY-UNTIL-BACKEND: no /api/users route defined in WP-01 contract.
   */
  users: (): Promise<PamUser[]> => Promise.resolve([]),

  usersList: (p?: ListParams): Promise<ListResult<PamUser>> =>
    Promise.resolve(emptyList<PamUser>(p)),

  // ── Projects ──────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no /api/projects route in contract.
   */
  projects: (): Promise<Project[]> => Promise.resolve([]),

  projectsList: (p?: ListParams): Promise<ListResult<Project>> =>
    Promise.resolve(emptyList<Project>(p)),

  // ── Agents ────────────────────────────────────────────────────────────
  /** GET /api/agents — returns agent profiles. */
  agents: (): Promise<Agent[]> =>
    request<{ agents: Agent[] }>("GET", "/api/agents").then(
      (r) => r.agents ?? [],
    ),

  // ── Mail-Guardian ─────────────────────────────────────────────────────
  /** GET /api/mail-guardian/reviews — returns mail reviews. */
  mail: (): Promise<MailReview[]> =>
    request<{ reviews: MailReview[] }>(
      "GET",
      "/api/mail-guardian/reviews",
    ).then((r) => r.reviews ?? []),

  /** Paginated mail reviews list. */
  mailList: (p?: ListParams): Promise<ListResult<MailReview>> =>
    request<{ reviews: MailReview[]; total?: number }>(
      "GET",
      "/api/mail-guardian/reviews",
      { query: toListQuery(p) },
    ).then((r) => {
      const rows = r.reviews ?? [];
      const q = (p?.q ?? "").trim().toLowerCase();
      const filtered = q
        ? rows.filter(
            (m) =>
              m.from.toLowerCase().includes(q) ||
              m.subject.toLowerCase().includes(q) ||
              m.snippet.toLowerCase().includes(q),
          )
        : rows;
      if (r.total !== undefined) {
        return normList({ rows: filtered, total: r.total }, p);
      }
      return clientSideList(filtered, p);
    }),

  // ── Notifications ──────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: /api/notifications is reserved but not in contract.
   */
  notifications: (): Promise<unknown[]> => Promise.resolve([]),

  // ── Env browser ────────────────────────────────────────────────────────
  /**
   * GET /api/env-browser — returns masked env entries.
   * Admin-only; returns empty array when unauthenticated.
   */
  envFiles: (): Promise<unknown[]> =>
    request<{ entries: unknown[] }>("GET", "/api/env-browser").then(
      (r) => r.entries ?? [],
    ),

  // ── Badges ────────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no /api/badges route in contract.
   * Badges are embedded in Service entities.
   */
  badges: (): Promise<unknown[]> => Promise.resolve([]),

  badgesList: (p?: ListParams): Promise<ListResult<unknown>> =>
    Promise.resolve(emptyList<unknown>(p)),

  // ── Backups ────────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no /api/backups route in contract.
   */
  backups: (): Promise<BackupSnapshot[]> => Promise.resolve([]),

  backupsList: (p?: ListParams): Promise<ListResult<BackupSnapshot>> =>
    Promise.resolve(emptyList<BackupSnapshot>(p)),

  // ── Scheduler ──────────────────────────────────────────────────────────
  /**
   * EMPTY-UNTIL-BACKEND: no /api/scheduler route in contract.
   */
  scheduler: (): Promise<SchedulerJob[]> => Promise.resolve([]),

  schedulerList: (p?: ListParams): Promise<ListResult<SchedulerJob>> =>
    Promise.resolve(emptyList<SchedulerJob>(p)),

  // ── Drives (from system payload) ───────────────────────────────────────
  /**
   * GET /api/storage — drives are part of the system response.
   * Fetches /api/system and extracts the drives array for pagination.
   */
  drivesList: (p?: ListParams): Promise<ListResult<DriveInfo>> =>
    request<{ disks: DriveInfo[] }>("GET", "/api/storage").then(
      (r) => {
        const rows = r.disks ?? [];
        const q = (p?.q ?? "").trim().toLowerCase();
        const filtered = q
          ? rows.filter(
              (d) =>
                d.name.toLowerCase().includes(q) ||
                (d.mount ?? "").toLowerCase().includes(q) ||
                (d.model ?? "").toLowerCase().includes(q),
            )
          : rows;
        return clientSideList(filtered, p);
      },
    ),
} as const;

// ---------------------------------------------------------------------------
// Client-side pagination helper (used for endpoints that return full arrays)
// ---------------------------------------------------------------------------

/**
 * Apply client-side pagination/sorting to an already-filtered array.
 * Used for endpoints that don't support server-side pagination.
 */
function clientSideList<T>(rows: T[], p: ListParams = {}): ListResult<T> {
  const pageSize = Math.max(1, p.pageSize ?? 25);
  const page = Math.max(0, p.page ?? 0);
  const slice = rows.slice(page * pageSize, (page + 1) * pageSize);
  return { rows: slice, total: rows.length, page, pageSize };
}
