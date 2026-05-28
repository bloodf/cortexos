"use client";

import { MailCheck } from "lucide-react";
import { useEffect, useState } from "react";

interface MailGuardianStats {
	actions?: Record<string, number>;
	openReviews?: number;
	totalProcessed?: number;
}

export function MailGuardianWidget() {
	const [stats, setStats] = useState<MailGuardianStats>({});

	useEffect(() => {
		let mounted = true;
		const load = () => {
			fetch("/api/mail-guardian")
				.then((res) => res.json())
				.then((data) => {
					if (mounted) setStats(data as MailGuardianStats);
				})
				.catch(() => {});
		};
		load();
		const interval = setInterval(load, 10000);
		return () => {
			mounted = false;
			clearInterval(interval);
		};
	}, []);

	const trashed = stats.actions?.trashed ?? 0;
	const pending = stats.actions?.pending_review ?? 0;
	const total = stats.totalProcessed ?? 0;

	return (
		<div className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-6 py-4">
			<MailCheck className="h-7 w-7 text-cyan-300" />
			<div className="min-w-0">
				<div className="text-2xl font-bold text-cyan-300">{total}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Mail checked</div>
				<div className="mt-1 text-[11px] text-muted-foreground">{trashed} trashed · {pending} review</div>
			</div>
		</div>
	);
}
