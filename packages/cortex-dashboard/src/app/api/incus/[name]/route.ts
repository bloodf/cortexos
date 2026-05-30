import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";

const SAFE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;

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

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
	const { name } = await params;
	if (!SAFE_NAME_RE.test(name)) {
		return NextResponse.json({ error: "Invalid instance name" }, { status: 400 });
	}

	const res = await runIncus(["info", name, "--format", "json"]);
	if ("error" in res) {
		return NextResponse.json({ error: res.error }, { status: 500 });
	}

	try {
		const info = JSON.parse(res.stdout);
		return NextResponse.json({ data: info });
	} catch {
		return NextResponse.json({ error: "Invalid JSON from incus" }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
