"use client";

import { BellDropdown } from "@/components/notifications/bell-dropdown";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function TopBar() {
	return (
		<header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
			<div className="flex items-center justify-between px-4 py-3">
				<div className="flex items-center gap-3 min-w-0">
					<SidebarTrigger className="lg:hidden" />
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src="/cortexos-logo.svg"
						alt="CortexOS"
						className="h-9 w-auto shrink-0"
					/>
					<div className="min-w-0">
						<h1 className="text-base font-bold tracking-tight truncate">Cortex Dashboard</h1>
						<p className="text-xs text-muted-foreground hidden sm:block truncate">
							CortexOS VPS Control Panel
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<BellDropdown />
				</div>
			</div>
		</header>
	);
}
