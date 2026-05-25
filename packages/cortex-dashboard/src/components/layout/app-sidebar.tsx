"use client";

import * as React from "react";
import { usePathname, Link } from "@/i18n/routing";
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
import { visibleNavGroups, type NavItem } from "@/components/navigation/nav-config";
import { cn } from "@/lib/utils";

export function AppSidebar() {
	const pathname = usePathname();
	const { open, isMobile } = useSidebar();
	const collapsed = !open && !isMobile;
	const groups = visibleNavGroups();

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
				{groups.map((group) => (
					<SidebarGroup key={group.label} className={collapsed ? "items-center" : undefined}>
						{!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
						{group.items.map((item) => (
							<NavLink
								key={item.href}
								item={item}
								active={isActive(pathname, item.href)}
								collapsed={collapsed}
							/>
						))}
					</SidebarGroup>
				))}
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
			title={collapsed ? item.labelKey : undefined}
		>
			<Icon className="size-4 shrink-0" />
			{!collapsed && <span className="truncate">{item.labelKey}</span>}
		</Link>
	);
}
