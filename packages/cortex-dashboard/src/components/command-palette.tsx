"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
	Command,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { useRouter } from "@/i18n/routing";
import { visibleNavItems } from "@/components/navigation/nav-config";
import { useTranslations } from "next-intl";

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
	const [services, setServices] = useState<Service[]>([]);
	const router = useRouter();
	const t = useTranslations("Navigation");
	const tc = useTranslations("CommandPalette");

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, []);

	useEffect(() => {
		if (!open) return;
		fetch("/api/services?webui=true")
			.then((response) => response.json())
			.then((data) => setServices(data.services || []))
			.catch(() => setServices([]));
	}, [open]);

	const filteredPages = useMemo(
		() =>
			visibleNavItems().filter((page) =>
				matches(query, [t(page.labelKey), page.labelKey, page.href]),
			),
		[query, t],
	);
	const filteredServices = useMemo(
		() =>
			services.filter((service) =>
				matches(query, [service.name, service.category, service.slug, service.open_url]),
			),
		[query, services],
	);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogTitle>{tc("Title")}</DialogTitle>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder={tc("Placeholder")}
						value={query}
						onValueChange={setQuery}
					/>
					<CommandList>
						{filteredPages.map((page) => (
							<CommandItem
								key={page.href}
								onSelect={() => {
									router.push(page.href);
									setOpen(false);
								}}
							>
								{t(page.labelKey)} <span className="ml-2 text-xs text-muted-foreground">{page.href}</span>
							</CommandItem>
						))}
						{filteredServices.map((service) => (
							<CommandItem
								key={service.slug}
								onSelect={() => {
									window.open(service.open_url, "_blank", "noopener,noreferrer");
									setOpen(false);
								}}
							>
								{service.name} <span className="ml-2 text-xs text-muted-foreground">{service.category || "App"}</span>
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}
