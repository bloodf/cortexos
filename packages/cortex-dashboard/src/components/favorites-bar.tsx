"use client";

import { X } from "lucide-react";
import { ServiceLogo } from "@/components/service-logo";
import { useFavorites } from "@/hooks/use-favorites";

export function FavoritesBar() {
	const { favorites, removeFavorite } = useFavorites();
	if (favorites.length === 0) return null;

	return (
		<div className="border-b border-border bg-background/40 backdrop-blur-md">
			<div className="mx-auto flex max-w-[1600px] gap-2 overflow-x-auto px-4 py-2 sm:px-6">
				{favorites.map((favorite) => (
					<div
						key={favorite.slug}
						className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs"
					>
						<a
							href={favorite.open_url}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 font-medium hover:text-indigo-300"
						>
							<ServiceLogo
								serviceId={favorite.slug}
								serviceName={favorite.name}
								size={18}
								iconColor={favorite.icon_color}
								iconImage={favorite.icon_image}
							/>
							{favorite.name}
						</a>
						<button
							type="button"
							aria-label={`Remove ${favorite.name}`}
							onClick={() => removeFavorite(favorite.slug)}
							className="rounded-full p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
						>
							<X className="h-3 w-3" />
						</button>
					</div>
				))}
			</div>
		</div>
	);
}
