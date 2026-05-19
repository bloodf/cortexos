"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function AlertsWidget() {
	const [count, setCount] = useState(0);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		const fetchAlerts = () => {
			fetch("/api/alerts?history=1")
				.then((r) => r.json())
				.then((d) => {
					if (mountedRef.current) setCount(Array.isArray(d.history) ? d.history.length : 0);
				})
				.catch(() => {});
		};
		fetchAlerts();
		const interval = setInterval(fetchAlerts, 10000);
		return () => {
			mountedRef.current = false;
			clearInterval(interval);
		};
	}, []);

	return (
		<div className="h-full flex flex-col gap-3">
			<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2">
				<Bell className="w-4 h-4 text-amber-400" />
				Alerts
			</h2>
			<div className="text-3xl font-bold">{count}</div>
			<p className="text-xs text-muted-foreground">recent alerts</p>
		</div>
	);
}
