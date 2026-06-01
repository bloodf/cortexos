// Shared domain types re-exported for the dashboard.
// Canonical definitions live in @/lib/sys-pilot/types.ts.

export type {
  Service,
  ServiceCheck,
  ServiceStatus,
  BadgeRef,
  SystemData,
  MachineSensor,
  DriveInfo,
  MountInfo,
  ProcessInfo,
  NetworkInterface,
  NetworkData,
  DockerContainer,
  DockerImage,
  DockerVolume,
  DockerNetwork,
  IncusInstance,
  IncusImage,
  SystemdUnit,
  AlertRule,
  AlertHistory,
  ApprovalRequest,
  AuditEntry,
  Badge,
  PamUser,
  Project,
  Agent,
  MailReview,
} from "@/lib/sys-pilot/types";

// Import the types we need for aliases below.
import type {
  Service,
  ApprovalRequest,
  DockerContainer,
  DockerImage,
  DockerVolume,
  SystemdUnit,
  IncusInstance,
} from "@/lib/sys-pilot/types";

// Additional alias types used across the dashboard
export type Healthcheck = Service;
export type Approval = ApprovalRequest;
export type Link = { url: string; label: string };
export type MailAccount = { address: string; provider: string; status: "active" | "suspended" };
export type ContainerInfo = DockerContainer;
export type ImageInfo = DockerImage;
export type VolumeInfo = DockerVolume;
export type UnitInfo = SystemdUnit;
export type InstanceInfo = IncusInstance;
export type BackupInfo = { id: string; name: string; created_at: string; size: number; status: string };
export type JobInfo = { id: string; name: string; schedule: string; next_run: string; enabled: boolean };
