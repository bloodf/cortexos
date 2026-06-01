// TODO: stub — replace with real backend calls (PAM exec, CLI wrappers, D-Bus).
// Return types are the stable contract the UI is built against; keep them when
// swapping stub bodies for real implementations.
import type {
  Service, SystemData, ProcessInfo, NetworkData,
  AlertRule, AlertHistory, DockerContainer, DockerImage, DockerVolume, DockerNetwork,
  IncusInstance, IncusImage, SystemdUnit, ApprovalRequest, AuditEntry,
  Badge, PamUser, Project, Agent, MailReview,
} from "@/lib/sys-pilot/types";

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
  services: async (): Promise<Service[]> => [],
  system: async (): Promise<SystemData> => emptySystem(),
  alerts: {
    rules: async (): Promise<AlertRule[]> => [],
    history: async (): Promise<AlertHistory[]> => [],
  },
  docker: {
    containers: async (): Promise<DockerContainer[]> => [],
    images: async (): Promise<DockerImage[]> => [],
    volumes: async (): Promise<DockerVolume[]> => [],
    networks: async (): Promise<DockerNetwork[]> => [],
  },
  agents: async (): Promise<Agent[]> => [],
  incus: {
    instances: async (): Promise<IncusInstance[]> => [],
    images: async (): Promise<IncusImage[]> => [],
  },
  systemd: async (): Promise<SystemdUnit[]> => [],
  storage: async (): Promise<DriveLike[]> => [],
  network: async (): Promise<NetworkData> => ({ interfaces: [] }),
  processes: async (): Promise<ProcessInfo[]> => [],
  healthcheck: async (): Promise<Service[]> => [],
  approvals: async (): Promise<ApprovalRequest[]> => [],
  audit: async (): Promise<AuditEntry[]> => [],
  mailGuardian: async (): Promise<MailReview[]> => [],
  users: async (): Promise<PamUser[]> => [],
  backups: async (): Promise<BackupEntry[]> => [],
  scheduler: async (): Promise<ScheduledJob[]> => [],
  notifications: async (): Promise<NotificationEntry[]> => [],
  badges: async (): Promise<Badge[]> => [],
  projects: async (): Promise<Project[]> => [],
};

// Loosely-typed placeholders for endpoints whose UI shape isn't yet pinned down.
type DriveLike = { name: string; total?: number; used?: number; percent?: number };
type BackupEntry = { id: string; name: string; created_at: string; size: number; status: string };
type ScheduledJob = { id: string; name: string; schedule: string; next_run: string; enabled: boolean };
type NotificationEntry = { id: string; channel: string; message: string; sent_at: string; status: string };
