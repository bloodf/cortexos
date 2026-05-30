import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";

interface IncusImage {
	fingerprint: string;
	architecture: string;
	type: string;
	size: number;
	uploaded_at: string;
	aliases: Array<{ name: string; description?: string }>;
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

export async function GET() {
	const res = await runIncus(["image", "list", "--format", "json"]);
	if ("error" in res) {
		return NextResponse.json({ data: [], error: res.error }, { status: 500 });
	}

	let images: IncusImage[] = [];
	try {
		images = JSON.parse(res.stdout) as IncusImage[];
	} catch {
		return NextResponse.json({ data: [], error: "Invalid JSON from incus" }, { status: 500 });
	}

	const data = images.map((i) => ({
		fingerprint: i.fingerprint,
		aliases: i.aliases.map((a) => a.name),
		architecture: i.architecture,
		size: i.size,
		created: i.uploaded_at,
		type: i.type,
	}));

	return NextResponse.json({ data });
}

export const dynamic = "force-dynamic";
