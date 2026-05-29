"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";
import { StatusBadge } from "@/components/services/status-badge";
import type { ServiceData } from "@/components/services";
import { useFavorites } from "@/hooks/use-favorites";

interface AppGridProps {
	services: ServiceData[];
}

export function AppGrid({ services }: AppGridProps) {
	return (
		<>
			<motion.div
				layout
				className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
			>
				<AnimatePresence>
					{services.map((s) => (
						<AppGridItem key={s.slug} service={s} />
					))}
				</AnimatePresence>
			</motion.div>
			{services.length === 0 && (
				<div className="py-20 text-center text-sm text-muted-foreground">
					No apps available
				</div>
			)}
		</>
	);
}

function AppGridItem({ service: s }: { service: ServiceData }) {
	const { isFavorite, toggleFavorite } = useFavorites();
	const favorite = isFavorite(s.slug);

	return (
		<motion.div
			layout
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			whileHover={{ scale: 1.02 }}
			transition={{
				duration: 0.15,
				layout: { type: "spring", stiffness: 500, damping: 30 },
			}}
			key={s.slug}
			className="group rounded-xl border border-border bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
		>
			<div className="flex items-start gap-3">
				<a
					href={s.open_url !== "#" ? s.open_url : undefined}
					target={s.open_url !== "#" ? "_blank" : undefined}
					rel="noopener noreferrer"
					className="flex min-w-0 flex-1 items-start gap-3"
				>
					<ServiceLogo
						serviceId={s.slug}
						size={36}
						iconColor={s.icon_color}
						iconImage={s.icon_image}
					/>
					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-medium text-foreground">
							{s.name}
						</div>
						<div className="mt-1.5">
							<StatusBadge status={s.status} responseTime={s.responseTime} />
						</div>
						{s.badges && s.badges.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-1">
								{s.badges.map((b, i) => (
									<Badge
										key={i}
										variant="outline"
										className="text-[10px] px-1.5 py-0"
										style={b.color ? { borderColor: b.color, color: b.color } : undefined}
									>
										{b.label}
									</Badge>
								))}
							</div>
						)}
					</div>
				</a>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={favorite ? `Unpin ${s.name}` : `Pin ${s.name}`}
					onClick={() =>
						toggleFavorite({
							id: s.id ?? 0,
							slug: s.slug,
							name: s.name,
							open_url: s.open_url,
							icon_color: s.icon_color,
							icon_image: s.icon_image,
						})
					}
					className="h-8 w-8 shrink-0"
				>
					<Star className={favorite ? "h-4 w-4 fill-amber-400 text-amber-400" : "h-4 w-4"} />
				</Button>
			</div>
		</motion.div>
	);
}
