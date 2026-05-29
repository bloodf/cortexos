"use client";

import * as React from "react";
import { usePathname, Link } from "@/i18n/routing";
import { ChevronDown } from "lucide-react";

import {
	Sidebar,
	SidebarHeader,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
} from "@/components/ui/sidebar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isNavActive, type NavGroup, type NavItem } from "./nav-config";

export function AppSidebar() {
	const pathname = usePathname();

	return (
		<Sidebar mobileTitle="Navigation">
			<SidebarHeader>
				<span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
					Cortex
				</span>
			</SidebarHeader>
			<SidebarContent>
				{NAV_GROUPS.map((group) =>
					group.collapsible ? (
						<CollapsibleNavGroup
							key={group.label}
							group={group}
							pathname={pathname}
						/>
					) : (
						<SidebarGroup key={group.label}>
							<SidebarGroupLabel className="text-sidebar-foreground/60">
								{group.label}
							</SidebarGroupLabel>
							{group.items.map((item) => (
								<NavLink
									key={item.href}
									item={item}
									active={isNavActive(pathname, item.href)}
								/>
							))}
						</SidebarGroup>
					),
				)}
			</SidebarContent>
			<SidebarFooter>
				<div className="flex items-center gap-2">
					<ThemeSwitcher />
					<LanguageSwitcher />
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}

function CollapsibleNavGroup({
	group,
	pathname,
}: {
	group: NavGroup;
	pathname: string;
}) {
	const hasActive = group.items.some((item) => isNavActive(pathname, item.href));
	const [open, setOpen] = React.useState(hasActive);

	return (
		<SidebarGroup>
			<Collapsible open={open} onOpenChange={setOpen}>
				<CollapsibleTrigger
					className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
				>
					<span>{group.label}</span>
					<ChevronDown
						className={cn(
							"size-3 transition-transform duration-200",
							open ? "rotate-0" : "-rotate-90",
						)}
					/>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
						{group.items.map((item) => (
							<NavLink
								key={item.href}
								item={item}
								active={isNavActive(pathname, item.href)}
							/>
						))}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</SidebarGroup>
	);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
	const Icon = item.icon;
	return (
		<Link
			href={item.href}
			data-active={active || undefined}
			aria-current={active ? "page" : undefined}
			className={cn(
				"flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
				active
					? "bg-sidebar-accent text-sidebar-accent-foreground"
					: "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
			)}
		>
			<Icon className="size-4 shrink-0" />
			<span className="truncate">{item.label}</span>
		</Link>
	);
}
