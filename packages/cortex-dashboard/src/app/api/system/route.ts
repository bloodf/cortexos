import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { hostExec } from "@/lib/host-exec";

function getCpuUsage(): number {
	try {
		if (existsSync("/proc/stat")) {
			const stat = readFileSync("/proc/stat", "utf-8");
			const line = stat.split("\n")[0];
			const parts = line.split(/\s+/).slice(1).map(Number);
			const [user, nice, system, idle, iowait, irq, softirq] = parts;
			const total = user + nice + system + idle + iowait + irq + softirq;
			const used = total - idle;
			return Math.round((used / total) * 100);
		}
	} catch {
		/* fallthrough */
	}
	try {
		const out = hostExec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
		const val = parseFloat(out.trim());
		if (!isNaN(val)) return Math.round(val);
	} catch {
		/* noop */
	}
	return -1;
}

function getMemory(): {
	total: number;
	used: number;
	free: number;
	percent: number;
} {
	try {
		if (existsSync("/proc/meminfo")) {
			const data = readFileSync("/proc/meminfo", "utf-8");
			const lines = data.split("\n");
			const getVal = (prefix: string) => {
				const line = lines.find((l) => l.startsWith(prefix));
				return line ? parseInt(line.split(/\s+/)[1], 10) : 0;
			};
			const total = getVal("MemTotal:");
			const available = getVal("MemAvailable:") || getVal("MemFree:");
			const used = total - available;
			return {
				total: Math.round(total / 1024),
				used: Math.round(used / 1024),
				free: Math.round(available / 1024),
				percent: Math.round((used / total) * 100),
			};
		}
	} catch {
		/* fallthrough */
	}
	try {
		const out = hostExec("free -m | awk 'NR==2{printf \"%s %s %s\", $2,$3,$4}'");
		const [total, used, free] = out.trim().split(" ").map(Number);
		return { total, used, free, percent: Math.round((used / total) * 100) };
	} catch {
		/* noop */
	}
	return { total: 0, used: 0, free: 0, percent: -1 };
}

interface DriveInfo {
	name: string;
	size: string;
	model: string;
	type: string;
	mount?: string;
	used?: string;
	total?: string;
	percent?: number;
}

function getPhysicalDrives(): DriveInfo[] {
	try {
		const diskOut = hostExec("lsblk -d -n -o NAME,SIZE,MODEL,TYPE");
		const disks = diskOut
			.trim()
			.split("\n")
			.map((line) => {
				const parts = line.trim().split(/\s+/);
				if (parts.length >= 3) {
					return {
						name: parts[0],
						size: parts[1],
						model: parts.slice(2, -1).join(" ") || "Unknown",
						type: parts[parts.length - 1] || "disk",
					};
				}
				return null;
			})
			.filter((d): d is DriveInfo => d !== null && d.type === "disk");

		const treeOut = hostExec("lsblk -n -o NAME,MOUNTPOINT");
		const diskMounts: Record<string, string> = {};
		let currentDisk = "";
		for (const line of treeOut.trim().split("\n")) {
			const stripped = line.replace(/[├└│─\s`|]/g, " ").trim();
			const parts = stripped.split(/\s+/);
			const devName = parts[0];
			const mountPoint = parts.slice(1).join(" ").trim();
			if (disks.some((d) => d.name === devName)) {
				currentDisk = devName;
			}
			if (currentDisk && mountPoint === "/") {
				diskMounts[currentDisk] = "/";
			} else if (currentDisk && mountPoint.startsWith("/mnt/") && !diskMounts[currentDisk]) {
				diskMounts[currentDisk] = mountPoint;
			}
		}

		const dfOut = hostExec("df -h");
		const dfLines = dfOut.trim().split("\n").slice(1);
		const mountUsage: Record<string, { total: string; used: string; percent: number }> = {};
		for (const line of dfLines) {
			const parts = line.trim().split(/\s+/);
			if (parts.length >= 6) {
				mountUsage[parts[5]] = {
					total: parts[1],
					used: parts[2],
					percent: parseInt(parts[4].replace("%", ""), 10),
				};
			}
		}

		return disks.map((d) => {
			const mount = diskMounts[d.name];
			const usage = mount ? mountUsage[mount] : undefined;
			return {
				...d,
				mount,
				total: usage?.total,
				used: usage?.used,
				percent: usage?.percent,
			};
		});
	} catch {
		/* noop */
	}
	return [];
}

interface MountInfo {
	filesystem: string;
	mount: string;
	total: string;
	used: string;
	free: string;
	percent: number;
}

function getMounts(): MountInfo[] {
	try {
		const out = hostExec("df -h -x tmpfs -x devtmpfs -x squashfs");
		const lines = out.trim().split("\n").slice(1);
		return lines
			.map((line) => {
				const parts = line.trim().split(/\s+/);
				if (parts.length >= 6) {
					return {
						filesystem: parts[0],
						mount: parts[5],
						total: parts[1],
						used: parts[2],
						free: parts[3],
						percent: parseInt(parts[4].replace("%", ""), 10),
					};
				}
				return null;
			})
			.filter(Boolean) as MountInfo[];
	} catch {
		/* noop */
	}
	return [];
}

function getUptime(): string {
	try {
		if (existsSync("/proc/uptime")) {
			const data = readFileSync("/proc/uptime", "utf-8");
			const seconds = parseFloat(data.split(" ")[0]);
			const days = Math.floor(seconds / 86400);
			const hours = Math.floor((seconds % 86400) / 3600);
			const mins = Math.floor((seconds % 3600) / 60);
			if (days > 0) return `${days}d ${hours}h ${mins}m`;
			return `${hours}h ${mins}m`;
		}
	} catch {
		/* fallthrough */
	}
	try {
		const out = hostExec("uptime -p").trim();
		return out.replace(/^up\s+/, "");
	} catch {
		/* noop */
	}
	return "unknown";
}

function getLoadAverage(): number[] {
	try {
		if (existsSync("/proc/loadavg")) {
			const data = readFileSync("/proc/loadavg", "utf-8");
			return data.split(" ").slice(0, 3).map(Number);
		}
	} catch {
		/* noop */
	}
	return [0, 0, 0];
}

export async function GET() {
	const cpu = getCpuUsage();
	const memory = getMemory();
	const drives = getPhysicalDrives();
	const mounts = getMounts();
	const uptime = getUptime();
	const load = getLoadAverage();

	return NextResponse.json({
		cpu,
		memory,
		drives,
		mounts,
		uptime,
		load,
		timestamp: Date.now(),
	});
}

export const dynamic = "force-dynamic";
