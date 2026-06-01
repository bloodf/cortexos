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
	useSidebar,
} from "@/components/ui/sidebar";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isNavActive, type NavGroup, type NavItem } from "./nav-config";

/** localStorage key persisting expanded/collapsed state per collapsible group. */
const ADMIN_GROUP_STORAGE_PREFIX = "cortex-nav-group:";

export function AppSidebar() {
	const pathname = usePathname();
	const { isRail } = useSidebar();

	return (
		<Sidebar mobileTitle="Navigation">
			<SidebarHeader>
				<span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
					{isRail ? "Cx" : "Cortex"}
				</span>
			</SidebarHeader>
			<SidebarContent>
				{NAV_GROUPS.map((group) =>
					group.collapsible && !isRail ? (
						<CollapsibleNavGroup
							key={group.label}
							group={group}
							pathname={pathname}
						/>
					) : (
						<SidebarGroup key={group.label}>
							{isRail ? (
								<div
									className="my-1 h-px w-6 self-center bg-sidebar-border"
									aria-hidden
								/>
							) : (
								<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
							)}
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
				<div
					className={cn(
						"flex items-center gap-2",
						isRail && "flex-col",
					)}
				>
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
	const storageKey = `${ADMIN_GROUP_STORAGE_PREFIX}${group.label}`;
	const [open, setOpen] = React.useState(hasActive);

	// Reconcile from persisted state on mount (defaults to "open if a child is
	// active" until the stored preference loads, avoiding hydration mismatch).
	React.useEffect(() => {
		try {
			const stored = window.localStorage.getItem(storageKey);
			// eslint-disable-next-line react-hooks/set-state-in-effect
			if (stored === "open") setOpen(true);
			else if (stored === "closed") setOpen(false);
		} catch {
			/* localStorage unavailable — keep heuristic default */
		}
	}, [storageKey]);

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		try {
			window.localStorage.setItem(storageKey, next ? "open" : "closed");
		} catch {
			/* ignore persistence failure */
		}
	};

	return (
		<SidebarGroup>
			<Collapsible open={open} onOpenChange={handleOpenChange}>
				<CollapsibleTrigger
					className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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
	const { isRail } = useSidebar();

	const link = (
		<Link
			href={item.href}
			data-active={active || undefined}
			aria-current={active ? "page" : undefined}
			aria-label={isRail ? item.label : undefined}
			className={cn(
				"group/navlink relative flex items-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
				isRail
					? "size-9 justify-center self-center"
					: "gap-2 px-2 py-1.5",
				active
					? "bg-sidebar-accent font-medium text-sidebar-primary"
					: "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
			)}
		>
			{/* Left accent bar on the active item (expanded only). */}
			{active && !isRail ? (
				<span
					className="absolute left-0 top-1/2 h-4 -translate-y-1/2 rounded-r-full bg-sidebar-primary"
					style={{ width: "2px" }}
					aria-hidden
				/>
			) : null}
			<Icon className="size-4 shrink-0" />
			{!isRail ? <span className="truncate">{item.label}</span> : null}
		</Link>
	);

	if (!isRail) return link;

	return (
		<Tooltip>
			<TooltipTrigger render={link} />
			<TooltipContent side="right" sideOffset={8}>
				{item.label}
			</TooltipContent>
		</Tooltip>
	);
}
