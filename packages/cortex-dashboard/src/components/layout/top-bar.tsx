"use client";

import * as React from "react";
import { Link, usePathname } from "@/i18n/routing";
import { Moon, Search, Sun } from "lucide-react";

import { BellDropdown } from "@/components/notifications/bell-dropdown";
import { MobileNav } from "@/components/mobile/mobile-nav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useTheme } from "@/hooks/use-theme";
import { openCommandPalette } from "@/components/command-palette";
import { ALL_NAV_ITEMS } from "./nav-config";

/** Title-case a route segment ("env-browser" → "Env Browser"). */
function humanize(segment: string): string {
	return segment
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

interface Crumb {
	href: string;
	label: string;
	isLast: boolean;
}

function buildCrumbs(pathname: string): Crumb[] {
	const segments = pathname.split("/").filter(Boolean);
	if (segments.length === 0) return [];

	let acc = "";
	return segments.map((segment, index) => {
		acc += `/${segment}`;
		const known = ALL_NAV_ITEMS.find((item) => item.href === acc);
		return {
			href: acc,
			label: known?.label ?? humanize(segment),
			isLast: index === segments.length - 1,
		};
	});
}

export function TopBar() {
	const pathname = usePathname();
	const { resolvedTheme, toggleTheme } = useTheme();
	const [mounted, setMounted] = React.useState(false);
	React.useEffect(() => setMounted(true), []);

	const crumbs = buildCrumbs(pathname);

	return (
		<header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
			<div className="flex items-center justify-between gap-3 px-4 py-3">
				<div className="flex min-w-0 items-center gap-2">
					<MobileNav />
					<SidebarTrigger className="hidden lg:inline-flex" />
					<Breadcrumb className="min-w-0">
						<BreadcrumbList className="flex-nowrap">
							<BreadcrumbItem>
								<BreadcrumbLink
									render={<Link href="/overview">Cortex</Link>}
								/>
							</BreadcrumbItem>
							{crumbs.map((crumb) => (
								<React.Fragment key={crumb.href}>
									<BreadcrumbSeparator />
									<BreadcrumbItem className="min-w-0">
										{crumb.isLast ? (
											<BreadcrumbPage className="truncate">
												{crumb.label}
											</BreadcrumbPage>
										) : (
											<BreadcrumbLink
												className="truncate"
												render={
													<Link href={crumb.href}>{crumb.label}</Link>
												}
											/>
										)}
									</BreadcrumbItem>
								</React.Fragment>
							))}
						</BreadcrumbList>
					</Breadcrumb>
				</div>

				<div className="flex shrink-0 items-center gap-1.5">
					<Button
						variant="outline"
						size="sm"
						onClick={openCommandPalette}
						className="hidden gap-2 text-muted-foreground sm:inline-flex"
						aria-label="Open command palette"
					>
						<Search className="size-4" />
						<span>Search</span>
						<kbd className="ml-2 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
							⌘K
						</kbd>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={openCommandPalette}
						className="sm:hidden"
						aria-label="Open command palette"
					>
						<Search className="size-4" />
					</Button>

					<BellDropdown />

					<Button
						variant="ghost"
						size="icon"
						onClick={toggleTheme}
						aria-label="Toggle theme"
						title="Toggle theme"
					>
						{mounted && resolvedTheme === "dark" ? (
							<Sun className="size-4" />
						) : (
							<Moon className="size-4" />
						)}
					</Button>
				</div>
			</div>
		</header>
	);
}
