"use client";

import { useState } from "react";
import { usePathname, Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import {
	Activity,
	LayoutGrid,
	HeartPulse,
	Container,
	Terminal,
} from "lucide-react";
import { NAV_GROUPS, isNavActive } from "@/components/layout/nav-config";

/** Five quick-access items for the fixed bottom bar. */
const BOTTOM_NAV = [
	{ href: "/overview", label: "Overview", icon: Activity },
	{ href: "/apps", label: "Apps", icon: LayoutGrid },
	{ href: "/healthcheck", label: "Healthcheck", icon: HeartPulse },
	{ href: "/docker", label: "Docker", icon: Container },
	{ href: "/terminal", label: "Terminal", icon: Terminal },
];

export function MobileNav() {
	const pathname = usePathname();
	const t = useTranslations("Navigation");
	const [open, setOpen] = useState(false);

	// Translate a nav label key, falling back to the raw label when no
	// translation exists (the identity-mock in tests returns the key as-is).
	const label = (value: string) => {
		const translated = t(value);
		return translated === value ? value : translated;
	};

	return (
		<>
			{/* Hamburger trigger for the grouped drawer */}
			<div className="flex items-center lg:hidden">
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger
						aria-label={label("Overview")}
						className="inline-flex items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 size-8 hover:bg-muted hover:text-foreground touch-manipulation"
					>
						<Menu className="size-5" />
					</SheetTrigger>
					<SheetContent side="left" className="w-[280px] p-0">
						<SheetHeader className="p-4 border-b border-border">
							<div className="flex items-center gap-3">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src="/cortexos-logo.svg"
									alt="CortexOS"
									className="h-9 w-auto"
								/>
								<SheetTitle className="text-base font-bold tracking-tight">
									Cortex Dashboard
								</SheetTitle>
							</div>
						</SheetHeader>
						<nav
							className="flex flex-col gap-4 overflow-y-auto p-3"
							aria-label="Mobile navigation"
						>
							{NAV_GROUPS.map((group) => (
								<div key={group.label} className="flex flex-col gap-1">
									<span className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										{group.label}
									</span>
									{group.items.map((item) => {
										const active = isNavActive(pathname, item.href);
										const Icon = item.icon;
										return (
											<Link
												key={item.href}
												href={item.href}
												onClick={() => setOpen(false)}
												className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] touch-manipulation ${
													active
														? "bg-secondary text-foreground"
														: "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
												}`}
											>
												<Icon className="size-5 shrink-0" />
												<span>{label(item.label)}</span>
											</Link>
										);
									})}
								</div>
							))}
						</nav>
					</SheetContent>
				</Sheet>
			</div>

			{/* Bottom fixed nav bar for quick access */}
			<nav
				className="fixed bottom-0 inset-x-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border lg:hidden safe-area-pb"
				aria-label="Bottom navigation"
			>
				<div className="flex items-center justify-around px-2 py-2">
					{BOTTOM_NAV.map((item) => {
						const active = isNavActive(pathname, item.href);
						const Icon = item.icon;
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[56px] min-h-[44px] justify-center touch-manipulation transition-colors ${
									active ? "text-foreground" : "text-muted-foreground"
								}`}
							>
								<Icon className="size-5" />
								<span className="text-[10px] font-medium leading-tight">
									{label(item.label)}
								</span>
								{active && (
									<span className="absolute bottom-1 size-1 rounded-full bg-foreground" />
								)}
							</Link>
						);
					})}
				</div>
			</nav>
		</>
	);
}
