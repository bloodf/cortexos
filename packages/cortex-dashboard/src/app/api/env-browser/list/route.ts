import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { assertPathAllowed } from "@/lib/secrets/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_ROOT = "/opt/cortexos/.secrets";
const HERMES_ROOT = "/opt/cortexos/.secrets/hermes";
const PROJECTS_ROOT = "/opt/cortexos/.secrets/projects";
const STACKS_ROOT = "/opt/cortexos/stacks";

function groupFor(filePath: string): string {
	if (filePath.startsWith(`${STACKS_ROOT}/`)) return "Stack";
	if (filePath.startsWith(`${HERMES_ROOT}/`)) return "Hermes";
	if (filePath.startsWith(`${PROJECTS_ROOT}/`)) return "Project";
	return "Secrets";
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await access(filePath, constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

function isAllowed(filePath: string): boolean {
	try {
		assertPathAllowed(filePath);
		return true;
	} catch {
		return false;
	}
}

async function listEnvFiles(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isFile() && entry.name.endsWith(".env"))
			.map((entry) => path.join(dir, entry.name))
			.filter(isAllowed);
	} catch {
		return [];
	}
}

async function listStackEnvFiles(): Promise<string[]> {
	try {
		const entries = await readdir(STACKS_ROOT, { withFileTypes: true });
		const files = entries
			.filter((entry) => entry.isDirectory())
			.map(async (entry) => {
				const filePath = path.join(STACKS_ROOT, entry.name, ".env");
				return isAllowed(filePath) && (await exists(filePath)) ? filePath : null;
			});
		return (await Promise.all(files)).filter((filePath): filePath is string => filePath !== null);
	} catch {
		return [];
	}
}

export async function GET(request: Request) {
	const auth = await requireAuth(request);
	if (auth.error) return auth.error;

	const discovered = await Promise.all([
		listEnvFiles(SECRET_ROOT),
		listEnvFiles(HERMES_ROOT),
		listEnvFiles(PROJECTS_ROOT),
		listStackEnvFiles(),
	]);
	const envFiles = Array.from(new Set(discovered.flat())).sort();

	const files = await Promise.all(
		envFiles.map(async (filePath) => ({
			path: filePath,
			group: groupFor(filePath),
			file: path.basename(filePath),
			exists: await exists(filePath),
		})),
	);

	return NextResponse.json({ files });
}
