"use client";

import { motion } from "framer-motion";
import { CATEGORIES } from "./types";

interface ServicesSidebarProps {
	activeCategory: string;
	onCategoryChange: (cat: string) => void;
	counts: Record<string, number>;
}

export function ServicesSidebar({ activeCategory, onCategoryChange, counts }: ServicesSidebarProps) {
	return (
		<>
			{/* Desktop sidebar */}
			<aside className="w-48 shrink-0 hidden md:block">
				<div className="glass-panel rounded-xl p-3 sticky top-24">
					<div className="space-y-1">
						{CATEGORIES.map((cat) => (
							<button
								type="button"
								key={cat}
								onClick={() => onCategoryChange(cat)}
								className={`relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
									activeCategory === cat
										? "text-white"
										: "text-white/50 light:text-slate-700 hover:bg-white/[0.03] hover:text-white/70 light:hover:text-slate-950 light:text-slate-700"
								}`}
							>
								{activeCategory === cat && (
									<motion.div
										layoutId="activeSidebarCat"
										className="absolute inset-0 bg-indigo-500/20 border border-indigo-500/20 rounded-lg"
										transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
									/>
								)}
								<span className="relative z-10">{cat}</span>
								<span
									className={`relative z-10 text-xs font-mono ${activeCategory === cat ? "text-indigo-400" : "text-white/20 light:text-slate-700"}`}
								>
									{counts[cat] || 0}
								</span>
							</button>
						))}
					</div>
				</div>
			</aside>

			{/* Mobile horizontal pill menu */}
			<div className="flex md:hidden gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1">
				{CATEGORIES.map((cat) => (
					<button
						type="button"
						key={cat}
						onClick={() => onCategoryChange(cat)}
						className={`relative shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
							activeCategory === cat
								? "text-white bg-indigo-500/20 border border-indigo-500/30"
								: "text-white/50 light:text-slate-700 bg-white/[0.03] border border-white/[0.04] hover:text-white/70 light:hover:text-slate-950 light:text-slate-700"
						}`}
					>
						{cat}
						<span
							className={`text-[10px] font-mono ${activeCategory === cat ? "text-indigo-400" : "text-white/20 light:text-slate-700"}`}
						>
							{counts[cat] || 0}
						</span>
					</button>
				))}
			</div>
		</>
	);
}
