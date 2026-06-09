/**
 * POST /api/agents/[slug]/files — update an agent profile file.
 *
 * Writes back to the profile directory on disk.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, stat } from 'node:fs/promises';

const AGENT_SCAN_PATHS_ENV = process.env.AGENT_SCAN_PATHS;
const DEFAULT_SCAN_PATHS: string[] = [
	'/home/cortexos/.openclaw',
	'/opt/cortexos/hermes/profiles',
];

function getScanPaths(): string[] {
	if (AGENT_SCAN_PATHS_ENV && AGENT_SCAN_PATHS_ENV.trim().length > 0) {
		return AGENT_SCAN_PATHS_ENV.split(',').map((s) => s.trim()).filter(Boolean);
	}
	return DEFAULT_SCAN_PATHS;
}

export const POST: RequestHandler = async ({ params, request, locals }: { params: Record<string, string>; request: Request; locals: App.Locals }) => {
	const user = locals.user as unknown as { isAdmin?: boolean } | null;
	if (!user?.isAdmin) {
		error(403, 'Admin required');
	}

	const slug = params.slug;
	if (!slug || !/^[a-z0-9_-]+$/.test(slug)) {
		error(400, 'Invalid slug');
	}

	let body: { path?: string; content?: string };
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}
	const filePath = body.path;
	const content = body.content ?? '';
	if (!filePath || typeof filePath !== 'string') {
		error(400, 'Missing path');
	}
	if (filePath.includes('..') || filePath.startsWith('/')) {
		error(400, 'Invalid path');
	}

	// Resolve the agent profile directory
	const scanPaths = getScanPaths();
	let agentDir: string | null = null;
	for (const base of scanPaths) {
		const dir = `${base}/${slug}`;
		try {
			const s = await stat(dir);
			if (s.isDirectory()) {
				agentDir = dir;
				break;
			}
		} catch {
			// continue
		}
	}
	if (!agentDir) {
		error(404, 'Agent not found');
	}

	const target = `${agentDir}/${filePath}`;
	if (!target.startsWith(agentDir + '/')) {
		error(400, 'Path traversal blocked');
	}

	try {
		await writeFile(target, content, 'utf-8');
		return json({ ok: true });
	} catch (e) {
		error(500, 'Write failed: ' + (e as Error).message);
	}
};
