"use client";

import * as React from "react";
import { usePathname, Link } from "@/i18n/routing";
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
	ChevronDown,
	ChevronRight,
	Settings,
	Tag,
	FileCode,
	Factory,
	Bell,
	Users,
	FolderKanban,
	ScrollText,
} from "lucide-react";
import {
	Sidebar,
	SidebarHeader,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	useSidebar,
} from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { cn } from "@/lib/utils";

interface NavItem {
	href: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
	{ href: "/overview", label: "Overview", icon: Activity },
	{ href: "/apps", label: "Apps", icon: LayoutGrid },
	{ href: "/healthcheck", label: "Healthcheck", icon: HeartPulse },
	{ href: "/agents", label: "Agents", icon: Bot },
	{ href: "/docker", label: "Docker", icon: Container },
	{ href: "/systemd", label: "Systemd", icon: Server },
	{ href: "/storage", label: "Storage", icon: HardDrive },
	{ href: "/network", label: "Network", icon: Network },
	{ href: "/processes", label: "Processes", icon: Box },
	{ href: "/terminal", label: "Terminal", icon: Terminal },
];

const PAPERCLIP_NAV: NavItem = {
	href: "/paperclip",
	label: "Paperclip",
	icon: Paperclip,
};
const PAPERCLIP_ENABLED = Boolean(process.env.NEXT_PUBLIC_PAPERCLIP_API_URL);

const ADMIN_NAV: NavItem[] = [
	{ href: "/admin/services", label: "Services", icon: Settings },
	{ href: "/admin/badges", label: "Badges", icon: Tag },
	{ href: "/admin/env-browser", label: "Env Browser", icon: FileCode },
	{ href: "/admin/systemd", label: "Systemd", icon: Server },
	{ href: "/admin/docker", label: "Docker", icon: Container },
	{ href: "/admin/agent-factory", label: "Agent Factory", icon: Factory },
	{ href: "/admin/alerts", label: "Alerts", icon: Bell },
	{ href: "/admin/users", label: "Users", icon: Users },
	{ href: "/admin/projects", label: "Projects", icon: FolderKanban },
	{ href: "/admin/audit", label: "Audit Log", icon: ScrollText },
	{ href: "/admin/account", label: "Account", icon: UserCog },
];

export function AppSidebar() {
	const pathname = usePathname();
	const { open, isMobile } = useSidebar();
	const collapsed = !open && !isMobile;
	const [adminOpen, setAdminOpen] = React.useState(
		pathname.startsWith("/admin"),
	);

	return (
		<Sidebar mobileTitle="Navigation">
			<SidebarHeader>
				<div className="flex items-center justify-between gap-2">
					{!collapsed && (
						<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Cortex
						</span>
					)}
				</div>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					{!collapsed && <SidebarGroupLabel>Main</SidebarGroupLabel>}
					{PRIMARY_NAV.map((item) => (
						<NavLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
					))}
					{PAPERCLIP_ENABLED && (
						<NavLink
							key={PAPERCLIP_NAV.href}
							item={PAPERCLIP_NAV}
							active={isActive(pathname, PAPERCLIP_NAV.href)}
							collapsed={collapsed}
						/>
					)}
				</SidebarGroup>

				<SidebarGroup>
					<button
						type="button"
						onClick={() => setAdminOpen((v) => !v)}
						aria-expanded={adminOpen}
						className={cn(
							"flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground",
							collapsed && "justify-center px-1",
						)}
					>
						{collapsed ? <Shield className="size-4" /> : <span>Admin</span>}
						{adminOpen ? (
							<ChevronDown className="size-3" />
						) : (
							<ChevronRight className="size-3" />
						)}
					</button>
					{adminOpen && (
						<div className={cn(
							"mt-1 flex flex-col gap-0.5",
							collapsed ? "items-center" : "ml-2 border-l border-border pl-2",
						)}>
							{ADMIN_NAV.map((item) => (
								<NavLink
									key={item.href}
									item={item}
									active={isActive(pathname, item.href)}
									compact
									collapsed={collapsed}
								/>
							))}
						</div>
					)}
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
					<ThemeSwitcher />
					{!collapsed && <LanguageSwitcher />}
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}

function isActive(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
	item,
	active,
	compact,
	collapsed,
}: {
	item: NavItem;
	active: boolean;
	compact?: boolean;
	collapsed?: boolean;
}) {
	const Icon = item.icon;
	return (
		<Link
			href={item.href}
			className={cn(
				"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
				active
					? "bg-secondary text-foreground"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
				compact && "text-xs",
				collapsed && "justify-center px-1.5",
			)}
			title={collapsed ? item.label : undefined}
		>
			<Icon className="size-4 shrink-0" />
			{!collapsed && <span className="truncate">{item.label}</span>}
		</Link>
	);
}
