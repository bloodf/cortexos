import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineRoute } from '$lib/server/route-helper';
import type { IncusInstance } from '$lib/types/dashboard';

const execFileAsync = promisify(execFile);

function mapStatus(s: string): IncusInstance['status'] {
	const lower = String(s).toLowerCase();
	switch (lower) {
		case 'running':
			return 'running';
		case 'stopped':
			return 'stopped';
		case 'frozen':
			return 'frozen';
		case 'error':
			return 'error';
		case 'starting':
			return 'provisioning';
		case 'stopping':
			return 'active';
		default:
			return 'active';
	}
}

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'incus',
	action: 'incus.list',
	handler: async () => {
		try {
			const { stdout } = await execFileAsync('incus', ['list', '--format', 'json']);
			const rows = JSON.parse(stdout) as Array<Record<string, unknown>>;
			const instances: IncusInstance[] = rows.map((r) => {
				let image = '';
				if (r.config && typeof r.config === 'object') {
					const cfg = r.config as Record<string, unknown>;
					image = String(cfg['image.os'] ?? cfg['image.description'] ?? '');
				}
				return {
					name: String(r.name ?? ''),
					slug: String(r.name ?? ''),
					status: mapStatus(String(r.status ?? '')),
					type: (String(r.type ?? 'container') as IncusInstance['type']) || 'container',
					image,
					cpu: 0,
					memory: 0,
				};
			});
			return { instances };
		} catch {
			return { instances: [] as IncusInstance[] };
		}
	},
});
