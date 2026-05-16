"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ServiceLogo } from "@/components/service-logo";
import { StatusBadge } from "./status-badge";
import type { ServiceData } from "./types";

interface ServiceGridProps {
	services: ServiceData[];
}

export function ServiceGrid({ services }: ServiceGridProps) {
	return (
		<>
			<motion.div
				layout
				className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
			>
				<AnimatePresence>
					{services.map((s) => (
						<ServiceGridItem key={s.slug} service={s} />
					))}
				</AnimatePresence>
			</motion.div>
			{services.length === 0 && (
				<div className="text-center text-white/20 light:text-slate-700 py-20 text-sm">
					No services match your filter
				</div>
			)}
		</>
	);
}

function ServiceGridItem({ service: s }: { service: ServiceData }) {
	return (
		<motion.a
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
			href={s.open_url !== "#" ? s.open_url : undefined}
			target={s.open_url !== "#" ? "_blank" : undefined}
			rel="noopener noreferrer"
			className="glass-panel rounded-xl p-4 border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.03] transition-all group shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)]"
		>
			<div className="flex items-start gap-3">
				<ServiceLogo
					serviceId={s.slug}
					size={36}
					iconColor={s.icon_color}
					iconImage={s.icon_image}
				/>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-medium text-white/80 light:text-slate-700 truncate">
						{s.name}
					</div>
					<div className="mt-1.5">
						<StatusBadge status={s.status} responseTime={s.responseTime} />
					</div>
				</div>
			</div>
		</motion.a>
	);
}
