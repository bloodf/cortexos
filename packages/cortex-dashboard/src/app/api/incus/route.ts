import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";

interface IncusInstance {
	name: string;
	status: string;
	status_code: number;
	type: string;
	architecture: string;
	created_at: string;
	state?: {
		network?: Record<
			string,
			{
				addresses?: Array<{ family: string; address: string }>;
			}
		>;
	};
	profiles?: string[];
	snapshots?: string[] | unknown[];
}

async function runIncus(args: string[]): Promise<{ stdout: string; stderr: string } | { error: string }> {
	try {
		const { stdout, stderr } = await hostExecFile("incus", args, {
			timeout: 15000,
			maxBuffer: 5 * 1024 * 1024,
		});
		return { stdout, stderr };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "incus command failed";
		return { error: msg };
	}
}

function extractIpv4(instance: IncusInstance): string | null {
	const networks = instance.state?.network;
	if (!networks) return null;
	for (const net of Object.values(networks)) {
		for (const addr of net.addresses ?? []) {
			if (addr.family === "inet") return addr.address;
		}
	}
	return null;
}

function extractIpv6(instance: IncusInstance): string | null {
	const networks = instance.state?.network;
	if (!networks) return null;
	for (const net of Object.values(networks)) {
		for (const addr of net.addresses ?? []) {
			if (addr.family === "inet6" && !addr.address.startsWith("fe80:")) return addr.address;
		}
	}
	return null;
}

export async function GET() {
	const res = await runIncus(["list", "--format", "json"]);
	if ("error" in res) {
		return NextResponse.json({ data: [], error: res.error }, { status: 500 });
	}

	let instances: IncusInstance[] = [];
	try {
		instances = JSON.parse(res.stdout) as IncusInstance[];
	} catch {
		return NextResponse.json({ data: [], error: "Invalid JSON from incus" }, { status: 500 });
	}

	const data = instances.map((i) => ({
		name: i.name,
		status: i.status,
		type: i.type,
		ipv4: extractIpv4(i),
		ipv6: extractIpv6(i),
		architecture: i.architecture,
		created: i.created_at,
		profiles: i.profiles ?? [],
		snapshotsCount: Array.isArray(i.snapshots) ? i.snapshots.length : 0,
	}));

	return NextResponse.json({ data });
}

export const dynamic = "force-dynamic";
