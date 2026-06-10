// Mock query functions. To swap to real API later, replace each body with `fetch('/api/...')`.
import {
  SERVICES,
  initialSystem,
  initialProcesses,
  initialNetwork,
  DOCKER_CONTAINERS,
  DOCKER_IMAGES,
  DOCKER_VOLUMES,
  INCUS_INSTANCES,
  SYSTEMD_UNITS,
  ALERT_RULES,
  ALERT_HISTORY,
  APPROVALS,
  AUDIT,
  USERS,
  PROJECTS,
  AGENTS,
  MAIL_REVIEWS,
  NOTIFICATIONS,
  ENV_FILES,
  BADGES,
  BACKUP_SNAPSHOTS,
  SCHEDULER_JOBS,
} from "./seed";
import { live } from "./drift";

const wait = (n = 120) => new Promise<void>((r) => setTimeout(r, n));

// ---------- Server pagination/search helpers ----------

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

interface ListConfig<T> {
  search?: (row: T, q: string) => boolean;
  sort?: Record<string, (row: T) => string | number>;
  defaultSort?: { key: string; dir?: SortDir };
}

/** Generic paginated/search/sort endpoint over an in-memory array. */
async function listFrom<T>(
  source: () => T[] | Promise<T[]>,
  params: ListParams = {},
  cfg: ListConfig<T> = {},
): Promise<ListResult<T>> {
  await wait();
  let rows = await source();
  const q = (params.q ?? "").trim().toLowerCase();
  if (q && cfg.search) rows = rows.filter((r) => cfg.search!(r, q));

  const sortKey = params.sortKey ?? cfg.defaultSort?.key ?? null;
  const sortDir = params.sortDir ?? cfg.defaultSort?.dir ?? "asc";
  if (sortKey && cfg.sort?.[sortKey]) {
    const get = cfg.sort[sortKey];
    rows = [...rows].sort((a, b) => {
      const av = get(a),
        bv = get(b);
      if (av === bv) return 0;
      const d = av > bv ? 1 : -1;
      return sortDir === "desc" ? -d : d;
    });
  }

  const total = rows.length;
  const pageSize = Math.max(1, params.pageSize ?? 25);
  const page = Math.max(0, params.page ?? 0);
  rows = rows.slice(page * pageSize, (page + 1) * pageSize);
  return { rows, total, page, pageSize };
}

const lower = (v: unknown) => String(v ?? "").toLowerCase();

// ---------- API surface ----------

export const api = {
  system: async () => {
    await wait();
    return live.system() ?? initialSystem;
  },
  processes: async () => {
    await wait();
    return live.processes() ?? initialProcesses;
  },
  network: async () => {
    await wait();
    return live.network() ?? initialNetwork;
  },
  services: async () => {
    await wait();
    return live.services() ?? SERVICES;
  },
  history: async () => {
    await wait();
    return live.history() ?? [];
  },

  docker: {
    containers: async () => {
      await wait();
      return DOCKER_CONTAINERS;
    },
    images: async () => {
      await wait();
      return DOCKER_IMAGES;
    },
    volumes: async () => {
      await wait();
      return DOCKER_VOLUMES;
    },
    containersList: (p?: ListParams) =>
      listFrom(() => DOCKER_CONTAINERS, p, {
        search: (r, q) =>
          lower(r.name).includes(q) ||
          lower(r.image).includes(q) ||
          lower(r.status).includes(q) ||
          lower(r.state).includes(q),
        sort: {
          name: (r) => r.name,
          image: (r) => r.image,
          state: (r) => r.state,
          status: (r) => r.status,
        },
        defaultSort: { key: "name" },
      }),
    imagesList: (p?: ListParams) =>
      listFrom(() => DOCKER_IMAGES, p, {
        search: (r, q) =>
          lower(r.repo).includes(q) || lower(r.tag).includes(q) || lower(r.id).includes(q),
        sort: {
          repo: (r) => r.repo,
          tag: (r) => r.tag,
          size: (r) => r.size,
          created: (r) => r.created,
        },
        defaultSort: { key: "repo" },
      }),
    volumesList: (p?: ListParams) =>
      listFrom(() => DOCKER_VOLUMES, p, {
        search: (r, q) =>
          lower(r.name).includes(q) ||
          lower(r.driver).includes(q) ||
          lower(r.mountpoint).includes(q),
        sort: { name: (r) => r.name, size: (r) => r.size },
        defaultSort: { key: "name" },
      }),
  },

  incus: async () => {
    await wait();
    return INCUS_INSTANCES;
  },
  incusList: (p?: ListParams) =>
    listFrom(() => INCUS_INSTANCES, p, {
      search: (r, q) =>
        lower(r.name).includes(q) ||
        lower(r.image).includes(q) ||
        lower(r.project.name).includes(q) ||
        lower(r.status).includes(q),
      sort: {
        project: (r) => r.project.name,
        name: (r) => r.name,
        type: (r) => r.type,
        status: (r) => r.status,
      },
      defaultSort: { key: "project" },
    }),

  systemd: async () => {
    await wait();
    return SYSTEMD_UNITS;
  },
  systemdList: (p?: ListParams) =>
    listFrom(() => SYSTEMD_UNITS, p, {
      search: (r, q) =>
        lower(r.name).includes(q) ||
        lower(r.description).includes(q) ||
        lower(r.active).includes(q),
      sort: { name: (r) => r.name, active: (r) => r.active, sub: (r) => r.sub },
      defaultSort: { key: "name" },
    }),

  alerts: {
    rules: async () => {
      await wait();
      return ALERT_RULES;
    },
    history: async () => {
      await wait();
      return live.alerts() ?? ALERT_HISTORY;
    },
    rulesList: (p?: ListParams) =>
      listFrom(() => ALERT_RULES, p, {
        search: (r, q) => lower(r.name).includes(q) || lower(r.condition).includes(q),
        sort: {
          name: (r) => r.name,
          condition: (r) => r.condition,
          enabled: (r) => String(r.enabled),
        },
        defaultSort: { key: "name" },
      }),
    historyList: (p?: ListParams) =>
      listFrom(() => live.alerts() ?? ALERT_HISTORY, p, {
        search: (r, q) =>
          lower(r.ruleName).includes(q) ||
          lower(r.serviceName).includes(q) ||
          lower(r.status).includes(q),
        sort: {
          timestamp: (r) => r.timestamp,
          ruleName: (r) => r.ruleName,
          status: (r) => r.status,
        },
        defaultSort: { key: "timestamp", dir: "desc" },
      }),
  },

  approvals: async () => {
    await wait();
    return APPROVALS;
  },

  audit: async () => {
    await wait();
    return AUDIT;
  },
  auditList: (p?: ListParams) =>
    listFrom(() => AUDIT, p, {
      search: (r, q) =>
        lower(r.actor).includes(q) ||
        lower(r.tool).includes(q) ||
        lower(r.decision_reason).includes(q),
      sort: {
        created_at: (r) => r.created_at,
        actor: (r) => r.actor,
        tool: (r) => r.tool,
        decision: (r) => r.decision,
      },
      defaultSort: { key: "created_at", dir: "desc" },
    }),

  users: async () => {
    await wait();
    return USERS;
  },
  usersList: (p?: ListParams) =>
    listFrom(() => USERS, p, {
      search: (r, q) => lower(r.username).includes(q) || r.groups.some((g) => lower(g).includes(q)),
      sort: { username: (r) => r.username, uid: (r) => r.uid, is_admin: (r) => String(r.is_admin) },
      defaultSort: { key: "username" },
    }),

  projects: async () => {
    await wait();
    return PROJECTS;
  },
  projectsList: (p?: ListParams) =>
    listFrom(() => PROJECTS, p, {
      search: (r, q) => lower(r.name).includes(q) || lower(r.description ?? "").includes(q),
      sort: { name: (r) => r.name, created_at: (r) => r.created_at },
      defaultSort: { key: "name" },
    }),

  agents: async () => {
    await wait();
    return AGENTS;
  },

  mail: async () => {
    await wait();
    return MAIL_REVIEWS;
  },
  mailList: (p?: ListParams) =>
    listFrom(() => MAIL_REVIEWS, p, {
      search: (r, q) =>
        lower(r.from).includes(q) || lower(r.subject).includes(q) || lower(r.snippet).includes(q),
      sort: {
        received_at: (r) => r.received_at,
        from: (r) => r.from,
        subject: (r) => r.subject,
        risk: (r) => r.risk,
        status: (r) => r.status,
      },
      defaultSort: { key: "received_at", dir: "desc" },
    }),

  notifications: async () => {
    await wait();
    return NOTIFICATIONS;
  },

  envFiles: async () => {
    await wait();
    return ENV_FILES;
  },

  badges: async () => {
    await wait();
    return BADGES;
  },
  badgesList: (p?: ListParams) =>
    listFrom(() => BADGES, p, {
      search: (r, q) => lower(r.slug).includes(q) || lower(r.label).includes(q),
      sort: { slug: (r) => r.slug, label: (r) => r.label },
      defaultSort: { key: "slug" },
    }),

  backups: async () => {
    await wait();
    return BACKUP_SNAPSHOTS;
  },
  backupsList: (p?: ListParams) =>
    listFrom(() => BACKUP_SNAPSHOTS, p, {
      search: (r, q) =>
        lower(r.target).includes(q) || lower(r.kind).includes(q) || lower(r.status).includes(q),
      sort: {
        createdAt: (r) => r.createdAt,
        target: (r) => r.target,
        sizeBytes: (r) => r.sizeBytes,
        status: (r) => r.status,
      },
      defaultSort: { key: "createdAt", dir: "desc" },
    }),

  scheduler: async () => {
    await wait();
    return SCHEDULER_JOBS;
  },
  schedulerList: (p?: ListParams) =>
    listFrom(() => SCHEDULER_JOBS, p, {
      search: (r, q) =>
        lower(r.name).includes(q) || lower(r.cron).includes(q) || lower(r.target).includes(q),
      sort: {
        name: (r) => r.name,
        nextRun: (r) => r.nextRun,
        lastRun: (r) => r.lastRun,
        status: (r) => r.status,
      },
      defaultSort: { key: "nextRun" },
    }),

  // Drives live inside system payload; expose a dedicated paginated endpoint.
  drivesList: (p?: ListParams) =>
    listFrom(async () => (live.system() ?? initialSystem).drives, p, {
      search: (r, q) =>
        lower(r.name).includes(q) || lower(r.mount ?? "").includes(q) || lower(r.model).includes(q),
      sort: {
        name: (r) => r.name,
        mount: (r) => r.mount ?? "",
        used: (r) => r.used ?? 0,
        size: (r) => r.size,
      },
      defaultSort: { key: "name" },
    }),

  healthcheckList: (p?: ListParams) =>
    listFrom(async () => live.services() ?? SERVICES, p, {
      search: (r, q) =>
        lower(r.name).includes(q) || lower(r.category).includes(q) || lower(r.status).includes(q),
      sort: {
        name: (r) => r.name,
        status: (r) => r.status,
        responseTime: (r) => r.responseTime,
        category: (r) => r.category,
      },
      defaultSort: { key: "name" },
    }),

  servicesList: (p?: ListParams) =>
    listFrom(async () => live.services() ?? SERVICES, p, {
      search: (r, q) =>
        lower(r.name).includes(q) || lower(r.category).includes(q) || lower(r.slug).includes(q),
      sort: {
        name: (r) => r.name,
        status: (r) => r.status,
        category: (r) => r.category,
        slug: (r) => r.slug,
      },
      defaultSort: { key: "name" },
    }),
};
