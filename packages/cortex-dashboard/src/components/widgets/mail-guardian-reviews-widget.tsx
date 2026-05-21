"use client";

import { ShieldQuestion } from "lucide-react";
import { useEffect, useState } from "react";

interface MailGuardianStats {
	openReviews?: number;
}

export function MailGuardianReviewsWidget() {
	const [openReviews, setOpenReviews] = useState(0);

	useEffect(() => {
		let mounted = true;
		const load = () => {
			fetch("/api/mail-guardian")
				.then((res) => res.json())
				.then((data: MailGuardianStats) => {
					if (mounted) setOpenReviews(Number(data.openReviews ?? 0));
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

	return (
		<div className="h-full flex items-center gap-3 rounded-xl border border-amber-500/20 bg-white/[0.01] px-4 py-3 min-h-[80px]">
			<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
				<ShieldQuestion className="h-5 w-5 text-amber-300" />
			</div>
			<div>
				<div className="text-2xl font-bold text-amber-300">{openReviews}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Mail Reviews</div>
			</div>
		</div>
	);
}
