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
		<div className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] items-center gap-3 rounded-2xl border border-chart-3/20 bg-chart-3/10 px-6 py-4">
			<MailCheck className="size-7 text-chart-3" />
			<div className="min-w-0">
				<div className="text-2xl font-bold text-chart-3">{total}</div>
				<div className="text-xs text-muted-foreground">Mail checked</div>
				<div className="mt-1 text-[11px] text-muted-foreground">{trashed} trashed · {pending} review</div>
			</div>
		</div>
	);
}
