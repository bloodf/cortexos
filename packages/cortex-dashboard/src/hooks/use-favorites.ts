"use client";

import { useState } from "react";

export type FavoriteService = {
	id: number;
	slug: string;
	name: string;
	open_url: string;
	icon_color?: string | null;
	icon_image?: string | null;
};

const KEY = "cortex-favorites";

function normalize(value: unknown): FavoriteService[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is FavoriteService => {
		return Boolean(
			item &&
				typeof item === "object" &&
				"id" in item &&
				"slug" in item &&
				"name" in item &&
				"open_url" in item,
		);
	});
}

function readFavorites(): FavoriteService[] {
	if (typeof window === "undefined") return [];
	try {
		return normalize(JSON.parse(localStorage.getItem(KEY) || "[]"));
	} catch {
		return [];
	}
}

export function useFavorites() {
	const [favorites, setFavorites] = useState<FavoriteService[]>(() => readFavorites());

	function save(next: FavoriteService[]) {
		setFavorites(next);
		localStorage.setItem(KEY, JSON.stringify(next));
	}

	function isFavorite(slug: string) {
		return favorites.some((favorite) => favorite.slug === slug);
	}

	function toggleFavorite(service: FavoriteService) {
		if (isFavorite(service.slug)) {
			save(favorites.filter((favorite) => favorite.slug !== service.slug));
			return;
		}
		save([...favorites, service]);
	}

	function removeFavorite(slug: string) {
		save(favorites.filter((favorite) => favorite.slug !== slug));
	}

	return { favorites, isFavorite, toggleFavorite, toggle: toggleFavorite, removeFavorite };
}
