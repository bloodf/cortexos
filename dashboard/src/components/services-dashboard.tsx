"use client";

import { useState, useMemo } from "react";
import { Settings } from "lucide-react";
import { SkeletonServiceGrid } from "@/components/skeleton";
import { AdminModal } from "@/components/admin-modal";
import { useServicesData } from "@/hooks/use-dashboard-data";
import {
	CATEGORIES,
	fuzzyMatch,
	ServicesSidebar,
	ServiceGrid,
	ServiceSearch,
} from "@/components/services";
import type { ServiceData } from "@/components/services";

export function ServicesDashboard({
	initialServices,
}: {
	initialServices: ServiceData[];
}) {
	const { data } = useServicesData();
	const services = data?.services || initialServices;
	const [activeCategory, setActiveCategory] = useState("All");
	const [search, setSearch] = useState("");
	const [showAdmin, setShowAdmin] = useState(false);

	const filtered = useMemo(() => {
		let list: ServiceData[] = services;
		if (activeCategory !== "All")
			list = list.filter((s) => s.category === activeCategory);
		if (search)
			list = list.filter(
				(s) => fuzzyMatch(search, s.name) || fuzzyMatch(search, s.category),
			);
		return list;
	}, [services, activeCategory, search]);

	const counts = useMemo(() => {
		const map: Record<string, number> = { All: services.length };
		CATEGORIES.slice(1).forEach((c) => {
			map[c] = services.filter((s: ServiceData) => s.category === c).length;
		});
		return map;
	}, [services]);

	return (
		<div className="flex flex-col md:flex-row gap-6 animate-[slide-in_0.4s_ease-out]">
			<ServicesSidebar
				activeCategory={activeCategory}
				onCategoryChange={setActiveCategory}
				counts={counts}
			/>

			{/* Main */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between mb-4 gap-3">
					<ServiceSearch value={search} onChange={setSearch} />
					<button
						onClick={() => setShowAdmin(true)}
						className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-500 light:bg-indigo-600 light:text-white light:hover:bg-indigo-500 transition-colors shrink-0 shadow-sm"
					>
						<Settings className="w-3.5 h-3.5" />
						Admin
					</button>
				</div>

				{services.length === 0 ? (
					<SkeletonServiceGrid count={8} />
				) : (
					<ServiceGrid services={filtered} />
				)}
			</div>
			<AdminModal
				open={showAdmin}
				onClose={() => setShowAdmin(false)}
				onUpdate={() => {}}
			/>
		</div>
	);
}
