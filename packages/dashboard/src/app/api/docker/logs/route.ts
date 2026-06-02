import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const name = searchParams.get("name") ?? "";

	if (!name || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(name)) {
		return NextResponse.json({ error: "Invalid container name" }, { status: 400 });
	}

	try {
		const { stdout, stderr } = await hostExecFile("docker", ["logs", "--tail", "300", "--timestamps", name], {
			timeout: 10000,
			maxBuffer: 5 * 1024 * 1024,
		});
		return NextResponse.json({ logs: stdout, stderr });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "docker command failed";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
