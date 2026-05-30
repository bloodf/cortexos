import { NextResponse } from "next/server";
import { hostExec } from "@/lib/host-exec";

interface InterfaceSnap {
	name: string;
	rxBytes: number;
	txBytes: number;
}

interface NetResult {
	name: string;
	rxKbps: number;
	txKbps: number;
	rxBytesTotal: number;
	txBytesTotal: number;
}

let previous: Record<string, InterfaceSnap> = {};
let lastTimestamp = 0;

function isPhysicalInterface(name: string): boolean {
	return name.startsWith("en") || name.startsWith("eth") || name.startsWith("wl");
}


function readNetDev(): InterfaceSnap[] {
	try {
		const out = hostExec("cat /proc/net/dev", 3000);
		const lines = out.trim().split("\n").slice(2);
		return lines
			.map((line) => {
				const trimmed = line.trim();
				if (!trimmed) return null;
				const parts = trimmed.split(/\s+/);
				const name = parts[0].replace(":", "");
				if (!isPhysicalInterface(name)) return null;
				return {
					name,
					rxBytes: parseInt(parts[1]) || 0,
					txBytes: parseInt(parts[9]) || 0,
				};
			})
			.filter(Boolean) as InterfaceSnap[];
	} catch {
		return [];
	}
}

function computeRates(current: InterfaceSnap[]): NetResult[] {
	const now = Date.now();
	const elapsedSec = lastTimestamp ? (now - lastTimestamp) / 1000 : 1;
	const results: NetResult[] = [];
	const nextPrevious: Record<string, InterfaceSnap> = {};

	for (const iface of current) {
		nextPrevious[iface.name] = iface;
		const prev = previous[iface.name];
		let rxKbps = 0;
		let txKbps = 0;
		if (prev) {
			const rxDelta = Math.max(0, iface.rxBytes - prev.rxBytes);
			const txDelta = Math.max(0, iface.txBytes - prev.txBytes);
			rxKbps = (rxDelta * 8) / 1024 / elapsedSec;
			txKbps = (txDelta * 8) / 1024 / elapsedSec;
		}
		results.push({
			name: iface.name,
			rxKbps,
			txKbps,
			rxBytesTotal: iface.rxBytes,
			txBytesTotal: iface.txBytes,
		});
	}

	previous = nextPrevious;
	lastTimestamp = now;
	return results;
}

export async function GET() {
	const current = readNetDev();
	const interfaces = computeRates(current);
	return NextResponse.json({ interfaces, timestamp: Date.now() });
}

export const dynamic = "force-dynamic";
