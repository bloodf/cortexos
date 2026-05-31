import type { LucideIcon } from "lucide-react";
import {
  Activity, LayoutGrid, HeartPulse, Bot, Container, Boxes, Server, HardDrive,
  Network, Cpu, Terminal, Mail, Bell, CheckCircle2, ScrollText, Settings2,
  BadgeCheck, FileKey, Users, FolderKanban, UserCog, Clock, Database,
} from "lucide-react";

export interface NavItem { to: string; key: keyof NavLabels; icon: LucideIcon; admin?: boolean }
export interface NavGroup { id: "platform" | "infra" | "secOps" | "admin"; items: NavItem[] }

type NavLabels = {
  overview: string; apps: string; healthcheck: string; agents: string; docker: string;
  incus: string; systemd: string; storage: string; network: string; processes: string;
  terminal: string; mail: string; alerts: string; approvals: string; audit: string;
  services: string; badges: string; env: string; users: string; projects: string; account: string;
  scheduler: string; backups: string;
};

export const NAV: NavGroup[] = [
  { id: "platform", items: [
    { to: "/overview", key: "overview", icon: Activity },
    { to: "/apps", key: "apps", icon: LayoutGrid },
    { to: "/healthcheck", key: "healthcheck", icon: HeartPulse },
    { to: "/agents", key: "agents", icon: Bot },
  ]},
  { id: "infra", items: [
    { to: "/docker", key: "docker", icon: Container },
    { to: "/incus", key: "incus", icon: Boxes },
    { to: "/systemd", key: "systemd", icon: Server },
    { to: "/storage", key: "storage", icon: HardDrive },
    { to: "/network", key: "network", icon: Network },
    { to: "/processes", key: "processes", icon: Cpu },
    { to: "/terminal", key: "terminal", icon: Terminal },
    { to: "/scheduler", key: "scheduler", icon: Clock },
    { to: "/backups", key: "backups", icon: Database },
  ]},
  { id: "secOps", items: [
    { to: "/mail-guardian", key: "mail", icon: Mail },
    { to: "/alerts", key: "alerts", icon: Bell },
    { to: "/approvals", key: "approvals", icon: CheckCircle2 },
    { to: "/audit", key: "audit", icon: ScrollText },
  ]},
  { id: "admin", items: [
    { to: "/admin/services", key: "services", icon: Settings2, admin: true },
    { to: "/admin/badges", key: "badges", icon: BadgeCheck, admin: true },
    { to: "/admin/env-browser", key: "env", icon: FileKey, admin: true },
    { to: "/admin/systemd", key: "systemd", icon: Server, admin: true },
    { to: "/admin/docker", key: "docker", icon: Container, admin: true },
    { to: "/admin/alerts", key: "alerts", icon: Bell, admin: true },
    { to: "/admin/users", key: "users", icon: Users, admin: true },
    { to: "/admin/projects", key: "projects", icon: FolderKanban, admin: true },
    { to: "/admin/incus", key: "incus", icon: Boxes, admin: true },
    { to: "/admin/audit", key: "audit", icon: ScrollText, admin: true },
    { to: "/admin/account", key: "account", icon: UserCog, admin: true },
  ]},
];

export const MOBILE_TABS = [
  { to: "/overview", key: "overview" as const, icon: Activity },
  { to: "/apps", key: "apps" as const, icon: LayoutGrid },
  { to: "/healthcheck", key: "healthcheck" as const, icon: HeartPulse },
  { to: "/docker", key: "docker" as const, icon: Container },
  { to: "/terminal", key: "terminal" as const, icon: Terminal },
];
