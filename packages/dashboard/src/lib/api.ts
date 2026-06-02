// HTTP client for the dashboard backend. Every method hits a real /api/* route
// and extracts the correctly-nested payload. Return types are the stable
// contract the UI is built against — keep them exactly as declared.
import type {
  Service, SystemData, ProcessInfo, NetworkData,
  AlertRule, AlertHistory, DockerContainer, DockerImage, DockerVolume, DockerNetwork,
  IncusInstance, IncusImage, SystemdUnit, ApprovalRequest, AuditEntry,
  Badge, PamUser, Project, Agent, MailReview,
} from "@/lib/sys-pilot/types";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json() as Promise<T>;
}

const emptySystem = (): SystemData => ({
  cpu: 0,
  memory: { percent: 0, used: 0, total: 0 },
  drives: [],
  mounts: [],
  load: [0, 0, 0],
  uptime: 0,
  sensors: { cpuTemperature: null, temperatures: [], fans: [], voltages: [] },
});

export const api = {
  // /api/services -> { services }
  services: async (): Promise<Service[]> =>
    (await get<{ services: Service[] }>("/api/services")).services ?? [],

  // /api/system -> SystemData (with extra timestamp field, ignored)
  system: async (): Promise<SystemData> => {
    try {
      return await get<SystemData>("/api/system");
    } catch {
      return emptySystem();
    }
  },

  alerts: {
    // /api/alerts -> { rules }
    rules: async (): Promise<AlertRule[]> =>
      (await get<{ rules: AlertRule[] }>("/api/alerts")).rules ?? [],
    // /api/alerts?history=1 -> { history }
    history: async (): Promise<AlertHistory[]> =>
      (await get<{ history: AlertHistory[] }>("/api/alerts?history=1")).history ?? [],
  },

  docker: {
    // /api/docker -> { containers: {data}, volumes: {data}, images: {data} }
    // (each section is paginated under a `data` key).
    containers: async (): Promise<DockerContainer[]> =>
      (await get<{ containers: { data: DockerContainer[] } }>("/api/docker")).containers?.data ?? [],
    images: async (): Promise<DockerImage[]> =>
      (await get<{ images: { data: DockerImage[] } }>("/api/docker")).images?.data ?? [],
    volumes: async (): Promise<DockerVolume[]> =>
      (await get<{ volumes: { data: DockerVolume[] } }>("/api/docker")).volumes?.data ?? [],
    // /api/docker does not expose a networks key — no backing data.
    networks: async (): Promise<DockerNetwork[]> => [],
  },

  // /api/agents -> { groups: [{ project, agents: [...] }] } — flatten to Agent[].
  agents: async (): Promise<Agent[]> => {
    type ScanFile = { name: string; path: string };
    type ScanAgent = { slug: string; name: string; files?: ScanFile[] };
    type ScanGroup = { project: string; agents: ScanAgent[] };
    const { groups = [] } = await get<{ groups: ScanGroup[] }>("/api/agents");
    return groups.flatMap((g) =>
      g.agents.map((a) => ({
        slug: a.slug,
        name: a.name,
        description: g.project,
        files: (a.files ?? []).map((f) => ({ path: f.path, language: "", content: "" })),
      })),
    );
  },

  incus: {
    // /api/incus/instances -> { data } (saved wizard configs)
    instances: async (): Promise<IncusInstance[]> =>
      (await get<{ data: IncusInstance[] }>("/api/incus/instances")).data ?? [],
    // /api/incus/images -> { data }
    images: async (): Promise<IncusImage[]> =>
      (await get<{ data: IncusImage[] }>("/api/incus/images")).data ?? [],
  },

  // /api/systemd -> { services } (systemd units live under the "services" key)
  systemd: async (): Promise<SystemdUnit[]> =>
    (await get<{ services: SystemdUnit[] }>("/api/systemd")).services ?? [],

  // No dedicated storage route — derive drive usage from /api/system mounts.
  storage: async (): Promise<DriveLike[]> => {
    try {
      const sys = await get<SystemData>("/api/system");
      return (sys.mounts ?? []).map((m) => ({
        name: m.mount,
        total: m.total,
        used: m.used,
        percent: m.percent,
      }));
    } catch {
      return [];
    }
  },

  // /api/network -> NetworkData { interfaces }
  network: async (): Promise<NetworkData> => {
    try {
      const d = await get<NetworkData>("/api/network");
      return { interfaces: d.interfaces ?? [] };
    } catch {
      return { interfaces: [] };
    }
  },

  // /api/processes -> { processes }
  processes: async (): Promise<ProcessInfo[]> =>
    (await get<{ processes: ProcessInfo[] }>("/api/processes")).processes ?? [],

  // Healthcheck list = services flagged show_in_healthcheck. /api/services -> { services }
  healthcheck: async (): Promise<Service[]> =>
    (await get<{ services: Service[] }>("/api/services?healthcheck=true")).services ?? [],

  // No /api/approvals route exists; /api/alerts/operational has an incompatible
  // (severity/message) shape, not ApprovalRequest. Keep empty.
  approvals: async (): Promise<ApprovalRequest[]> => [],

  // /api/audit -> { rows, total, ... }
  audit: async (): Promise<AuditEntry[]> =>
    (await get<{ rows: AuditEntry[] }>("/api/audit")).rows ?? [],

  // /api/mail-guardian returns aggregate stats (actions/openReviews/recentReviews),
  // not a per-mail MailReview[] (no from/subject/snippet/body/risk). No backing data.
  mailGuardian: async (): Promise<MailReview[]> => [],

  // /api/admin/users -> { users } (read-only PAM-backed list)
  users: async (): Promise<PamUser[]> =>
    (await get<{ users: PamUser[] }>("/api/admin/users")).users ?? [],

  // No /api/backups route.
  backups: async (): Promise<BackupEntry[]> => [],
  // No /api/scheduler route.
  scheduler: async (): Promise<ScheduledJob[]> => [],
  // No /api/notifications route.
  notifications: async (): Promise<NotificationEntry[]> => [],

  // /api/badges -> { badges }
  badges: async (): Promise<Badge[]> =>
    (await get<{ badges: Badge[] }>("/api/badges")).badges ?? [],

  // /api/projects -> { projects }
  projects: async (): Promise<Project[]> =>
    (await get<{ projects: Project[] }>("/api/projects")).projects ?? [],
};

// Loosely-typed placeholders for endpoints whose UI shape isn't yet pinned down.
type DriveLike = { name: string; total?: number; used?: number; percent?: number };
type BackupEntry = { id: string; name: string; created_at: string; size: number; status: string };
type ScheduledJob = { id: string; name: string; schedule: string; next_run: string; enabled: boolean };
type NotificationEntry = { id: string; channel: string; message: string; sent_at: string; status: string };
