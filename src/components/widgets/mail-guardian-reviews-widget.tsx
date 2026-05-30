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
		<div className="-m-4 flex h-[calc(100%+2rem)] min-h-[112px] items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-6 py-4">
			<ShieldQuestion className="h-7 w-7 text-amber-300" />
			<div>
				<div className="text-2xl font-bold text-amber-300">{openReviews}</div>
				<div className="text-xs text-white/40 light:text-slate-700">Mail Reviews</div>
			</div>
		</div>
	);
}
