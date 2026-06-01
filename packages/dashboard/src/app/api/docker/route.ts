import { NextResponse } from "next/server";
import { hostExecFile } from "@/lib/host-exec";

interface DockerResult {
	data: unknown[];
	error?: string;
}

async function runDocker(args: string[]): Promise<{ stdout: string; stderr: string } | { error: string }> {
	try {
		const { stdout, stderr } = await hostExecFile("docker", args, {
			timeout: 10000,
			maxBuffer: 5 * 1024 * 1024,
		});
		return { stdout, stderr };
	} catch (e) {
		const msg = e instanceof Error ? e.message : "docker command failed";
		return { error: msg };
	}
}

function parseJsonLines(res: { stdout: string } | { error: string }): DockerResult {
	if ("error" in res) {
		return { data: [], error: res.error };
	}
	const lines = res.stdout
		.trim()
		.split("\n")
		.filter((line) => line.trim().length > 0);
	const data: unknown[] = [];
	for (const line of lines) {
		try {
			data.push(JSON.parse(line));
		} catch {
			data.push({ raw: line });
		}
	}
	return { data };
}

export async function GET() {
	const [containersRes, volumesRes, imagesRes] = await Promise.all([
		runDocker(["ps", "-a", "--format", "{{json .}}"]),
		runDocker(["volume", "ls", "--format", "{{json .}}"]),
		runDocker(["images", "--format", "{{json .}}"]),
	]);

	return NextResponse.json({
		containers: parseJsonLines(containersRes),
		volumes: parseJsonLines(volumesRes),
		images: parseJsonLines(imagesRes),
	});
}

export const dynamic = "force-dynamic";
