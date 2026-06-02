import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";

export async function GET() {
	try {
		const { stdout } = await hostExecFile("docker", ["network", "ls", "--no-trunc", "--format", "{{json .}}"], {
			timeout: 10000,
			maxBuffer: 5 * 1024 * 1024,
		});
		const networks = stdout
			.trim()
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.map((line) => {
				const obj = JSON.parse(line);
				return { id: obj.ID, name: obj.Name, driver: obj.Driver, scope: obj.Scope };
			});
		return NextResponse.json({ networks });
	} catch (e) {
		const msg = e instanceof Error ? e.message : "docker command failed";
		return NextResponse.json({ error: msg }, { status: 500 });
	}
}

export const dynamic = "force-dynamic";
