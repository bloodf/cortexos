"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Search, HardDrive, ArrowUpDown } from "lucide-react";

interface MountInfo {
	filesystem: string;
	mount: string;
	total: string;
	used: string;
	free: string;
	percent: number;
}
interface DriveInfo {
	name: string;
	size: string;
	model: string;
	type: string;
}

function fuzzyMatch(query: string, text: string): boolean {
	if (!query) return true;
	const q = query.toLowerCase().replace(/\s+/g, "");
	const t = text.toLowerCase().replace(/\s+/g, "");
	let qi = 0;
	for (let ti = 0; ti < t.length && qi < q.length; ti++)
		if (t[ti] === q[qi]) qi++;
	return qi === q.length;
}

type SortKey = "mount" | "total" | "used" | "free" | "percent";

export default function StoragePage() {
	const [mounts, setMounts] = useState<MountInfo[]>([]);
	const [drives, setDrives] = useState<DriveInfo[]>([]);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
		key: "mount",
		dir: "asc",
	});
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		const fetchData = async () => {
			try {
				const res = await fetch("/api/system", { cache: "no-store" });
				if (res.ok && mountedRef.current) {
					const data = await res.json();
					setMounts(data.mounts || []);
					setDrives(data.drives || []);
				}
			} catch {
				// polling retries in 5s
			}
		};
		fetchData();
		const interval = setInterval(fetchData, 5000);
		return () => {
			mountedRef.current = false;
			clearInterval(interval);
		};
	}, []);

	const filtered = useMemo(() => {
		let list = mounts;
		if (search)
			list = list.filter(
				(m) => fuzzyMatch(search, m.mount) || fuzzyMatch(search, m.filesystem),
			);
		list = [...list].sort((a, b) => {
			const va = a[sort.key];
			const vb = b[sort.key];
			if (sort.key === "percent") {
				return sort.dir === "asc"
					? (va as number) - (vb as number)
					: (vb as number) - (va as number);
			}
			return sort.dir === "asc"
				? (va as string).localeCompare(vb as string)
				: (vb as string).localeCompare(va as string);
		});
		return list;
	}, [mounts, search, sort]);

	function toggleSort(key: SortKey) {
		setSort((prev) => ({
			key,
			dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
		}));
	}

	const thBtn = (label: string, k: SortKey, right?: boolean) => (
		<button
			onClick={() => toggleSort(k)}
			className={`flex items-center gap-1 hover:text-white/80 light:hover:text-slate-950 light:text-slate-700 transition-colors ${right ? "justify-end w-full" : ""}`}
		>
			{label}
			<ArrowUpDown
				className={`w-3 h-3 ${sort.key === k ? "text-indigo-400" : "text-white/10 light:text-slate-700"}`}
			/>
		</button>
	);

	return (
		<div className="space-y-6 animate-[slide-in_0.4s_ease-out]">
			<div className="glass-panel rounded-2xl p-6">
				<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2 mb-4">
					<HardDrive className="w-4 h-4 text-amber-400" />
					Physical Drives
				</h2>
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
					{drives.map((d) => (
						<div
							key={d.name}
							className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04]"
						>
							<div className="text-xs text-white/30 light:text-slate-700 font-mono mb-1">
								{d.name}
							</div>
							<div
								className="text-sm font-medium text-white/70 light:text-slate-700 truncate"
								title={d.model}
							>
								{d.model}
							</div>
							<div className="flex items-center gap-2 mt-2">
								<span className="text-lg font-bold text-amber-400">
									{d.size}
								</span>
								<span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/30 light:text-slate-700">
									{d.type}
								</span>
							</div>
						</div>
					))}
					{drives.length === 0 && (
						<div className="text-white/20 light:text-slate-700 text-sm">No drives detected</div>
					)}
				</div>
			</div>

			<div className="glass-panel rounded-2xl p-6">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-sm font-semibold text-white/80 light:text-slate-700 flex items-center gap-2">
						<HardDrive className="w-4 h-4 text-cyan-400" />
						Mount Points
					</h2>
					<div className="relative max-w-xs">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 light:text-slate-700" />
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search mounts..."
							className="pl-9 pr-3 py-1.5 bg-white/[0.02] border border-white/[0.06] rounded-lg text-xs text-white/70 light:text-slate-700 placeholder:text-white/20 light:text-slate-700 focus:outline-none focus:border-indigo-500/40"
						/>
					</div>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-left">
						<thead>
							<tr className="border-b border-white/[0.06]">
								<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
									{thBtn("Mount", "mount")}
								</th>
								<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider">
									{thBtn("Filesystem", "mount")}
								</th>
								<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
									{thBtn("Size", "total", true)}
								</th>
								<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
									{thBtn("Used", "used", true)}
								</th>
								<th className="pb-3 pr-4 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
									{thBtn("Free", "free", true)}
								</th>
								<th className="pb-3 text-[11px] font-semibold text-white/40 light:text-slate-700 uppercase tracking-wider text-right">
									{thBtn("Usage", "percent", true)}
								</th>
							</tr>
						</thead>
						<tbody className="text-sm">
							{filtered.map((m) => {
								const pct = m.percent || 0;
								return (
									<tr
										key={m.mount}
										className="border-b border-white/[0.03] hover:bg-white/[0.02]"
									>
										<td className="py-3 pr-4 font-mono text-white/60 light:text-slate-700">
											{m.mount}
										</td>
										<td className="py-3 pr-4 text-white/40 light:text-slate-700 text-xs">
											{m.filesystem}
										</td>
										<td className="py-3 pr-4 text-right text-white/60 light:text-slate-700 font-mono">
											{m.total}
										</td>
										<td className="py-3 pr-4 text-right text-white/60 light:text-slate-700 font-mono">
											{m.used}
										</td>
										<td className="py-3 pr-4 text-right text-emerald-400/70 font-mono">
											{m.free}
										</td>
										<td className="py-3 text-right">
											<div className="flex items-center justify-end gap-2">
												<div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
													<div
														className="h-full rounded-full"
														style={{
															width: `${pct}%`,
															backgroundColor:
																pct > 90
																	? "#ef4444"
																	: pct > 70
																		? "#f59e0b"
																		: "#10b981",
														}}
													/>
												</div>
												<span
													className={`text-xs font-mono font-medium ${pct > 90 ? "text-red-400" : pct > 70 ? "text-amber-400" : "text-emerald-400"}`}
												>
													{pct}%
												</span>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					{filtered.length === 0 && (
						<div className="text-center text-white/20 light:text-slate-700 py-12 text-sm">
							No mount points found
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
