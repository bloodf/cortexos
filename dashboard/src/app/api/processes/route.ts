import { NextResponse } from "next/server";
import { hostExec } from "@/lib/host-exec";

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
	expanded?: boolean;
}

function parsePsEeo(): Omit<ProcessNode, "children" | "depth">[] {
	try {
		// pid,ppid,user,pcpu,pmem,vsz,rss,tty,stat,comm,args
		const out = hostExec("ps -eo pid,ppid,user,pcpu,pmem,vsz,rss,tty,stat,comm,args --sort=-%cpu");
		const lines = out.trim().split("\n").slice(1);
		const result: Omit<ProcessNode, "children" | "depth">[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const parts = trimmed.split(/\s+/);
			if (parts.length < 10) continue;
			const pid = parseInt(parts[0], 10);
			const ppid = parseInt(parts[1], 10);
			const user = parts[2];
			const cpu = parseFloat(parts[3]);
			const mem = parseFloat(parts[4]);
			const vsz = parts[5];
			const rss = parts[6];
			const tty = parts[7];
			const stat = parts[8];
			const command = parts.slice(10).join(" ") || parts[9];
			result.push({ pid, ppid, user, cpu, mem, vsz, rss, tty, stat, command });
		}
		return result;
	} catch {
		return [];
	}
}

function buildTree(
	processes: Omit<ProcessNode, "children" | "depth">[],
	parentPid = 0,
	depth = 0,
	visited = new Set<number>(),
): ProcessNode[] {
	if (depth > 20) return []; // safety limit
	const children = processes.filter(
		(p) => p.ppid === parentPid && !visited.has(p.pid),
	);
	// Fallback for root level: if no children with ppid 0, use processes whose ppid doesn't exist in pid list
	if (children.length === 0 && parentPid === 0 && depth === 0) {
		const pids = new Set(processes.map((p) => p.pid));
		const roots = processes.filter(
			(p) => !pids.has(p.ppid) || p.ppid === 0 || p.ppid === 1 || p.ppid === 2,
		);
		if (roots.length > 0) {
			return roots.map((r) => {
				const nextVisited = new Set(visited);
				nextVisited.add(r.pid);
				return {
					...r,
					children: buildTree(processes, r.pid, depth + 1, nextVisited),
					depth,
					expanded: depth < 1,
				};
			});
		}
	}
	return children.map((c) => {
		const nextVisited = new Set(visited);
		nextVisited.add(c.pid);
		return {
			...c,
			children: buildTree(processes, c.pid, depth + 1, nextVisited),
			depth,
			expanded: depth < 1,
		};
	});
}

export async function GET() {
	const flat = parsePsEeo();
	const tree = buildTree(flat);
	return NextResponse.json({ processes: tree, timestamp: Date.now() });
}

export const dynamic = "force-dynamic";
