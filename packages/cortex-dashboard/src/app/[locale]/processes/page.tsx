"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
	Search,
	Cpu,
	ArrowUpDown,
	ChevronRight,
	ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonTable } from "@/components/skeleton";

interface ProcessNode {
	pid: number;
	ppid: number;
	user: string;
	cpu: number;
	mem: number;
	vsz: string;
	rss: string;
	tty: string;
	stat: string;
	command: string;
	children: ProcessNode[];
	depth: number;
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

type SortKey = "pid" | "user" | "cpu" | "mem" | "command";

function sortNodes(
	nodes: ProcessNode[],
	key: SortKey,
	dir: "asc" | "desc",
): ProcessNode[] {
	const sorted = [...nodes].sort((a, b) => {
		if (key === "pid") return dir === "asc" ? a.pid - b.pid : b.pid - a.pid;
		if (key === "cpu" || key === "mem") {
			return dir === "asc" ? a[key] - b[key] : b[key] - a[key];
		}
		return dir === "asc"
			? a[key].localeCompare(b[key])
			: b[key].localeCompare(a[key]);
	});
	return sorted.map((n) => ({
		...n,
		children: sortNodes(n.children, key, dir),
	}));
}

function filterNodes(
	nodes: ProcessNode[],
	query: string,
): { nodes: ProcessNode[]; count: number } {
	if (!query) return { nodes, count: countAll(nodes) };
	let count = 0;
	const filtered = nodes
		.map((n) => {
			const childResult = filterNodes(n.children, query);
			const selfMatch =
				fuzzyMatch(query, n.command) ||
				fuzzyMatch(query, n.user) ||
				fuzzyMatch(query, String(n.pid));
			if (selfMatch || childResult.nodes.length > 0) {
				count += 1 + childResult.count;
				return { ...n, children: childResult.nodes };
			}
			return null;
		})
		.filter(Boolean) as ProcessNode[];
	return { nodes: filtered, count };
}

function countAll(nodes: ProcessNode[]): number {
	return nodes.reduce((s, n) => s + 1 + countAll(n.children), 0);
}

interface TreeRowProps {
	node: ProcessNode;
	sort: { key: SortKey; dir: "asc" | "desc" };
	expanded: Set<string>;
	onToggle: (pid: number) => void;
}

function TreeRow({ node, sort, expanded, onToggle }: TreeRowProps) {
	const isExpanded = expanded.has(String(node.pid));
	const hasChildren = node.children.length > 0;
	const cpu = node.cpu;
	const mem = node.mem;

	return (
		<>
			<tr
				className="border-b border-border hover:bg-muted/50"
				style={{ marginLeft: `${node.depth * 20}px` }}
			>
				<td className="py-2 pr-4">
					<div
						className="flex items-center gap-1"
						style={{ paddingLeft: `${node.depth * 16}px` }}
					>
						{hasChildren ? (
							<button
								onClick={() => onToggle(node.pid)}
								className="text-muted-foreground hover:text-foreground w-4 h-4 flex items-center justify-center"
							>
								{isExpanded ? (
									<ChevronDown className="w-3 h-3" />
								) : (
									<ChevronRight className="w-3 h-3" />
								)}
							</button>
						) : (
							<span className="w-4" />
						)}
						<span className="font-mono text-foreground text-xs">{node.pid}</span>
					</div>
				</td>
				<td className="py-2 pr-4 text-foreground text-xs">{node.user}</td>
				<td className="py-2 pr-4 text-right">
					<span
						className={`font-mono font-medium text-xs ${cpu > 30 ? "text-destructive" : cpu > 10 ? "text-warning" : "text-success"}`}
					>
						{cpu.toFixed(1)}%
					</span>
				</td>
				<td className="py-2 pr-4 text-right">
					<span
						className={`font-mono font-medium text-xs ${mem > 10 ? "text-destructive" : mem > 5 ? "text-warning" : "text-success"}`}
					>
						{mem.toFixed(1)}%
					</span>
				</td>
				<td className="py-2 pr-4 text-right font-mono text-muted-foreground text-xs">
					{node.vsz}
				</td>
				<td className="py-2 pr-4 text-right font-mono text-muted-foreground text-xs">
					{node.rss}
				</td>
				<td className="py-2 pr-4 text-muted-foreground text-xs">{node.tty}</td>
				<td className="py-2 pr-4 text-muted-foreground text-xs">{node.stat}</td>
				<td
					className="py-2 text-foreground text-xs truncate max-w-[300px]"
					title={node.command}
				>
					{node.command}
				</td>
			</tr>
			{isExpanded &&
				node.children.map((child) => (
					<TreeRow
						key={child.pid}
						node={child}
						sort={sort}
						expanded={expanded}
						onToggle={onToggle}
					/>
				))}
		</>
	);
}

export default function ProcessesPage() {
	const t = useTranslations("Infrastructure");
	const [processes, setProcesses] = useState<ProcessNode[]>([]);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
		key: "cpu",
		dir: "desc",
	});
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		const fetchData = async () => {
			try {
				const res = await fetch("/api/processes", { cache: "no-store" });
				if (res.ok && mountedRef.current) {
					const data = await res.json();
					setProcesses(data.processes || []);
					setLoading(false);
					// Auto-expand root nodes on first load
					setExpanded((prev) => {
						if (prev.size > 0) return prev;
						const roots = new Set<string>();
						(data.processes || []).forEach((n: ProcessNode) =>
							roots.add(String(n.pid)),
						);
						return roots;
					});
				}
			} catch {
				// polling retries in 2s
			}
		};
		fetchData();
		const interval = setInterval(fetchData, 2000);
		return () => {
			mountedRef.current = false;
			clearInterval(interval);
		};
	}, []);

	const toggleExpand = useCallback((pid: number) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			const key = String(pid);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const sorted = useMemo(
		() => sortNodes(processes, sort.key, sort.dir),
		[processes, sort],
	);
	const filtered = useMemo(() => filterNodes(sorted, search), [sorted, search]);

	function toggleSort(key: SortKey) {
		setSort((prev) => ({
			key,
			dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
		}));
	}

	const thBtn = (label: string, k: SortKey, right?: boolean) => (
		<button
			onClick={() => toggleSort(k)}
			className={`flex items-center gap-1 hover:text-foreground transition-colors ${right ? "justify-end w-full" : ""}`}
		>
			{label}
			<ArrowUpDown
				className={`w-3 h-3 ${sort.key === k ? "text-primary" : "text-muted-foreground/40"}`}
			/>
		</button>
	);

	return (
		<div className="flex flex-col gap-6 p-6">
			<PageHeader
				title={t("ProcessesTitle")}
				description={t("ProcessesDescription")}
				icon={<Cpu />}
				actions={
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">
							{filtered.count} {t("ProcessesTitle").toLowerCase()}
						</span>
						<div className="relative max-w-xs">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
							<input
								type="text"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder={t("SearchProcesses")}
								className="pl-9 pr-3 py-1.5 bg-secondary border border-border rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring"
							/>
						</div>
					</div>
				}
			/>
			<Card>
				<CardContent className="overflow-x-auto">
					{loading ? (
						<SkeletonTable rows={8} cols={9} />
					) : filtered.nodes.length === 0 ? (
						<EmptyState title={t("NoProcesses")} />
					) : (
						<table className="w-full text-left">
							<thead>
								<tr className="border-b border-border">
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
										{thBtn("PID", "pid")}
									</th>
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
										{thBtn("User", "user")}
									</th>
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
										{thBtn("CPU%", "cpu", true)}
									</th>
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
										{thBtn("Mem%", "mem", true)}
									</th>
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
										{thBtn("VSZ", "mem", true)}
									</th>
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
										{thBtn("RSS", "mem", true)}
									</th>
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
										{thBtn("TTY", "user")}
									</th>
									<th className="pb-3 pr-4 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
										{thBtn("Stat", "user")}
									</th>
									<th className="pb-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
										{thBtn("Command", "command")}
									</th>
								</tr>
							</thead>
							<tbody className="text-xs">
								{filtered.nodes.map((n) => (
									<TreeRow
										key={n.pid}
										node={n}
										sort={sort}
										expanded={expanded}
										onToggle={toggleExpand}
									/>
								))}
							</tbody>
						</table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
