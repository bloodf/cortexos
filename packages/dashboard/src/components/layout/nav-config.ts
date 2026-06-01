import type { ComponentType } from "react";
import {
	Activity,
	LayoutGrid,
	HeartPulse,
	Bot,
	Container,
	Boxes,
	Server,
	HardDrive,
	Network,
	Cpu,
	Terminal,
	Mail,
	Bell,
	CheckCircle2,
	ScrollText,
	Settings2,
	BadgeCheck,
	FileKey,
	Users,
	FolderKanban,
	UserCog,
	Archive,
	Calendar,
} from "lucide-react";

export interface NavItem {
	href: string;
	label: string;
	icon: ComponentType<{ className?: string }>;
}

export interface NavGroup {
	label: string;
	items: NavItem[];
	/** Render as a collapsible group, collapsed by default. */
	collapsible?: boolean;
}

/**
 * Shared navigation definition consumed by the desktop sidebar, the mobile
 * drawer, and the command palette so all three stay in sync. Each item carries
 * a distinct, meaningful lucide icon.
 */
export const NAV_GROUPS: NavGroup[] = [
	{
		label: "Platform",
		items: [
			{ href: "/overview", label: "Overview", icon: Activity },
			{ href: "/apps", label: "Apps", icon: LayoutGrid },
			{ href: "/healthcheck", label: "Healthcheck", icon: HeartPulse },
			{ href: "/agents", label: "Agents", icon: Bot },
		],
	},
	{
		label: "Infrastructure",
		items: [
			{ href: "/docker", label: "Docker", icon: Container },
			{ href: "/incus", label: "Incus", icon: Boxes },
			{ href: "/systemd", label: "Systemd", icon: Server },
			{ href: "/storage", label: "Storage", icon: HardDrive },
			{ href: "/network", label: "Network", icon: Network },
			{ href: "/processes", label: "Processes", icon: Cpu },
			{ href: "/terminal", label: "Terminal", icon: Terminal },
			{ href: "/backups", label: "Backups", icon: Archive },
			{ href: "/scheduler", label: "Scheduler", icon: Calendar },
		],
	},
	{
		label: "Security & Ops",
		items: [
			{ href: "/mail-guardian", label: "Mail Guardian", icon: Mail },
			{ href: "/alerts", label: "Alerts", icon: Bell },
			{ href: "/approvals", label: "Approvals", icon: CheckCircle2 },
			{ href: "/audit", label: "Audit", icon: ScrollText },
		],
	},
	{
		label: "Admin",
		collapsible: true,
		items: [
			{ href: "/admin/services", label: "Services", icon: Settings2 },
			{ href: "/admin/badges", label: "Badges", icon: BadgeCheck },
			{ href: "/admin/env-browser", label: "Env Browser", icon: FileKey },
			{ href: "/admin/systemd", label: "Systemd", icon: Server },
			{ href: "/admin/docker", label: "Docker", icon: Container },
			{ href: "/admin/alerts", label: "Alerts", icon: Bell },
			{ href: "/admin/users", label: "Users", icon: Users },
			{ href: "/admin/projects", label: "Projects", icon: FolderKanban },
			{ href: "/admin/incus", label: "Incus", icon: Boxes },
			{ href: "/admin/audit", label: "Audit Log", icon: ScrollText },
			{ href: "/admin/account", label: "Account", icon: UserCog },
		],
	},
];

/** Flat list of every nav item across all groups. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Match a route against a nav href (handles nested routes). */
export function isNavActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}
