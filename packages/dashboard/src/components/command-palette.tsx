"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Moon, Palette, Sun } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
	CommandShortcut,
} from "@/components/ui/command";
import { useRouter } from "@/i18n/routing";
import { useTheme, usePreset, PRESETS } from "@/hooks/use-theme";
import { TechIcon } from "@/components/tech-icon";
import { ALL_NAV_ITEMS } from "@/components/layout/nav-config";

const COMMAND_PALETTE_EVENT = "cortex:command-palette";

/** Open the global command palette from anywhere (e.g. the top-bar button). */
export function openCommandPalette() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

type Service = {
	name: string;
	open_url: string;
	category?: string;
	slug: string;
};

function matches(query: string, values: Array<string | undefined>) {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return values.some((value) => value?.toLowerCase().includes(q));
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const router = useRouter();
	const { resolvedTheme, toggleTheme } = useTheme();
	const { preset, setPreset } = usePreset();

	const { data: servicesData } = useSWR<{ services: Service[] }>(
		open ? "/api/services?webui=true" : null,
		(url: string) => fetch(url).then((r) => r.json()),
	);
	const services = useMemo(() => servicesData?.services || [], [servicesData]);

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}
		};
		const openHandler = () => setOpen(true);
		window.addEventListener("keydown", handler);
		window.addEventListener(COMMAND_PALETTE_EVENT, openHandler);
		return () => {
			window.removeEventListener("keydown", handler);
			window.removeEventListener(COMMAND_PALETTE_EVENT, openHandler);
		};
	}, []);

	const filteredNav = useMemo(
		() => ALL_NAV_ITEMS.filter((item) => matches(query, [item.label, item.href])),
		[query],
	);
	const filteredServices = useMemo(
		() =>
			services.filter((service) =>
				matches(query, [
					service.name,
					service.category,
					service.slug,
					service.open_url,
				]),
			),
		[query, services],
	);

	const nextPreset = useMemo(() => {
		const index = PRESETS.indexOf(preset);
		return PRESETS[(index + 1) % PRESETS.length];
	}, [preset]);

	const go = (href: string) => {
		router.push(href);
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogTitle className="sr-only">Command Palette</DialogTitle>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search pages, services, and actions…"
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						<CommandEmpty>No results found.</CommandEmpty>

						{filteredNav.length > 0 && (
							<CommandGroup heading="Navigation">
								{filteredNav.map((item) => {
									const Icon = item.icon;
									return (
										<CommandItem
											key={item.href}
											value={`${item.label} ${item.href}`}
											onSelect={() => go(item.href)}
										>
											<Icon className="size-4" />
											<span>{item.label}</span>
											<CommandShortcut>{item.href}</CommandShortcut>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}

						{filteredServices.length > 0 && (
							<>
								<CommandSeparator />
								<CommandGroup heading="Services">
									{filteredServices.map((service) => (
										<CommandItem
											key={service.slug}
											value={`${service.name} ${service.slug} ${service.category ?? ""}`}
											onSelect={() => {
												window.open(
													service.open_url,
													"_blank",
													"noopener,noreferrer",
												);
												setOpen(false);
											}}
										>
											<TechIcon name={service.slug} size={16} />
											<span>{service.name}</span>
											<CommandShortcut>
												{service.category || "App"}
											</CommandShortcut>
										</CommandItem>
									))}
								</CommandGroup>
							</>
						)}

						<CommandSeparator />
						<CommandGroup heading="Actions">
							<CommandItem
								value="toggle theme dark light mode"
								onSelect={() => {
									toggleTheme();
									setOpen(false);
								}}
							>
								{resolvedTheme === "dark" ? (
									<Sun className="size-4" />
								) : (
									<Moon className="size-4" />
								)}
								<span>
									Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
								</span>
							</CommandItem>
							<CommandItem
								value="switch accent preset theme color"
								onSelect={() => {
									setPreset(nextPreset);
									setOpen(false);
								}}
							>
								<Palette className="size-4" />
								<span>Switch accent to {nextPreset}</span>
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
