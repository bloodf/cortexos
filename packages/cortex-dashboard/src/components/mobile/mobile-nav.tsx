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
import {
	Activity,
	LayoutGrid,
	HeartPulse,
	Bot,
	Container,
	Server,
	Network,
	Factory,
	Tag,
	FileCode,
	FolderKanban,
	ScrollText,
	Shield,
	Bell,
	Box,
	HardDrive,
	Terminal,
	Menu,
	Mail,
} from "lucide-react";

const navConfig = [
	{ href: "/overview", labelKey: "Overview", icon: Activity },
	{ href: "/alerts", labelKey: "Alerts", icon: Bell },
	{ href: "/mail-guardian", labelKey: "Mail Guardian", icon: Mail },
	{ href: "/apps", labelKey: "Apps", icon: LayoutGrid },
	{ href: "/services", labelKey: "Services", icon: HeartPulse },
	{ href: "/agents", labelKey: "Agents", icon: Bot },
	{ href: "/agent-factory", labelKey: "Agent Factory", icon: Factory },
	{ href: "/docker", labelKey: "Docker", icon: Container },
	{ href: "/systemd", labelKey: "Systemd", icon: Server },
	{ href: "/storage", labelKey: "Storage", icon: HardDrive },
	{ href: "/network", labelKey: "Network", icon: Network },
	{ href: "/processes", labelKey: "Processes", icon: Box },
	{ href: "/terminal", labelKey: "Terminal", icon: Terminal },
	{ href: "/projects", labelKey: "Projects", icon: FolderKanban },
	{ href: "/badges", labelKey: "Badges", icon: Tag },
	{ href: "/env-browser", labelKey: "Env Browser", icon: FileCode },
	{ href: "/audit", labelKey: "Audit", icon: ScrollText },
	{ href: "/tool-audit", labelKey: "Tool Audit", icon: Shield },
];

export function MobileNav() {
	const pathname = usePathname();
	const t = useTranslations("Navigation");
	const [open, setOpen] = useState(false);

	const _activeItem = navConfig.find(
		(item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
	);

	return (
		<>
			{/* Hamburger trigger for sheet */}
			<div className="flex items-center lg:hidden">
				<Sheet open={open} onOpenChange={setOpen}>
					<SheetTrigger
						aria-label={t("Overview")}
						className="inline-flex items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 size-8 hover:bg-muted hover:text-foreground touch-manipulation"
					>
						<Menu className="w-5 h-5" />
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
						<nav className="flex flex-col gap-1 p-3" aria-label="Mobile navigation">
							{navConfig.map((item) => {
								const isActive =
									pathname === item.href || pathname.startsWith(`${item.href}/`);
								return (
								<Link
									key={item.href}
									href={item.href}
									onClick={() => setOpen(false)}
									className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] touch-manipulation ${
										isActive
											? "bg-secondary text-foreground"
											: "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
									}`}
								>
									<item.icon className="w-5 h-5 shrink-0" />
									<span>{t(item.labelKey)}</span>
								</Link>
								);
								})}
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
					{navConfig.slice(0, 5).map((item) => {
						const isActive =
							pathname === item.href || pathname.startsWith(`${item.href}/`);
						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg min-w-[56px] min-h-[44px] justify-center touch-manipulation transition-colors ${
									isActive
										? "text-foreground"
										: "text-muted-foreground"
								}`}
							>
								<item.icon className="w-5 h-5" />
								<span className="text-[10px] font-medium leading-tight">
									{t(item.labelKey)}
								</span>
								{isActive && (
									<span className="absolute bottom-1 w-1 h-1 rounded-full bg-foreground" />
								)}
							</Link>
						);
					})}
				</div>
			</nav>
		</>
	);
}
