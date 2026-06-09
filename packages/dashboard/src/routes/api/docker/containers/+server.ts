import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineRoute } from '$lib/server/route-helper';
import type { DockerContainer } from '$lib/types/dashboard';

const execFileAsync = promisify(execFile);
const DOCKER_PS_FORMAT = '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}|{{.Ports}}|{{.CreatedAt}}';

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'docker',
	action: 'docker.list',
	handler: async () => {
		try {
			const { stdout } = await execFileAsync('docker', ['ps', '-a', '--format', DOCKER_PS_FORMAT]);
			const lines = stdout.trim().split('\n');
			const containers: DockerContainer[] = [];
			for (const line of lines) {
				if (!line.trim()) continue;
				const parts = line.split('|');
				if (parts.length < 7) continue;
				const [id, name, image, status, state, ports, created] = parts;
				containers.push({
					id: id ?? '',
					name: name ?? '',
					image: image ?? '',
					status: status ?? '',
					state: (state as DockerContainer['state']) || 'exited',
					ports: ports ?? '',
					created: created ?? '',
				});
			}
			return { containers };
		} catch {
			return { containers: [] as DockerContainer[] };
		}
	},
});
