"use client";

import type { ComponentType } from "react";
import {
	Activity,
	LayoutGrid,
	HeartPulse,
	Bot,
	Container,
	Server,
	HardDrive,
	Network,
	Box,
	Terminal,
	Shield,
	UserCog,
	Paperclip,
	Settings,
	Tag,
	FileCode,
	Bell,
	ScrollText,
	Mail,
	PackageOpen,
} from "lucide-react";

export interface NavItem {
	href: string;
	labelKey: string;
	icon: ComponentType<{ className?: string }>;
	paperclip?: boolean;
}

export interface NavGroup {
	label: string;
	items: NavItem[];
}

export const PAPERCLIP_ENABLED = Boolean(process.env.NEXT_PUBLIC_PAPERCLIP_API_URL);

export const NAV_GROUPS: NavGroup[] = [
	{
		label: "Work",
		items: [
			{ href: "/overview", labelKey: "Overview", icon: Activity },
			{ href: "/apps", labelKey: "Apps", icon: LayoutGrid },
			{ href: "/paperclip", labelKey: "Paperclip", icon: Paperclip, paperclip: true },
			{ href: "/mail-guardian", labelKey: "Mail Guardian", icon: Mail },
		],
	},
	{
		label: "Operate",
		items: [
			{ href: "/healthcheck", labelKey: "Healthcheck", icon: HeartPulse },
			{ href: "/alerts", labelKey: "Alerts", icon: Bell },
			{ href: "/agents", labelKey: "Agents", icon: Bot },
			{ href: "/services", labelKey: "Services", icon: Settings },
			{ href: "/updates", labelKey: "Updates", icon: PackageOpen },
		],
	},
	{
		label: "System",
		items: [
			{ href: "/docker", labelKey: "Docker", icon: Container },
			{ href: "/systemd", labelKey: "Systemd", icon: Server },
			{ href: "/storage", labelKey: "Storage", icon: HardDrive },
			{ href: "/network", labelKey: "Network", icon: Network },
			{ href: "/processes", labelKey: "Processes", icon: Box },
			{ href: "/terminal", labelKey: "Terminal", icon: Terminal },
		],
	},
	{
		label: "Admin",
		items: [
			{ href: "/users", labelKey: "Users", icon: UserCog },
			{ href: "/badges", labelKey: "Badges", icon: Tag },
			{ href: "/env-browser", labelKey: "Env Browser", icon: FileCode },
			{ href: "/audit", labelKey: "Audit", icon: ScrollText },
			{ href: "/tool-audit", labelKey: "Tool Audit", icon: Shield },
		],
	},
];

export function visibleNavGroups(paperclipEnabled = PAPERCLIP_ENABLED): NavGroup[] {
	return NAV_GROUPS.map((group) => ({
		...group,
		items: group.items.filter((item) => !item.paperclip || paperclipEnabled),
	})).filter((group) => group.items.length > 0);
}

export function visibleNavItems(paperclipEnabled = PAPERCLIP_ENABLED): NavItem[] {
	return visibleNavGroups(paperclipEnabled).flatMap((group) => group.items);
}

export function quickNavItems(paperclipEnabled = PAPERCLIP_ENABLED): NavItem[] {
	const items = visibleNavItems(paperclipEnabled);
	const desired = paperclipEnabled
		? ["/overview", "/apps", "/paperclip", "/healthcheck", "/agents"]
		: ["/overview", "/apps", "/mail-guardian", "/healthcheck", "/agents"];

	return desired
		.map((href) => items.find((item) => item.href === href))
		.filter((item): item is NavItem => Boolean(item));
}
