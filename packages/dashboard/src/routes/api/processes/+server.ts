import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineRoute } from '$lib/server/route-helper';
import type { ProcessInfo } from '$lib/types/dashboard';

const execFileAsync = promisify(execFile);

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'system',
	action: 'processes.list',
	handler: async () => {
		try {
			const { stdout } = await execFileAsync('ps', ['aux', '--no-header']);
			const lines = stdout.trim().split('\n');
			const procs: ProcessInfo[] = [];
			for (const line of lines) {
				const cols = line.trim().split(/\s+/);
				if (cols.length < 11) continue;
				const pid = Number.parseInt(cols[1] ?? '', 10);
				const cpu = Number.parseFloat(cols[2] ?? '');
				const mem = Number.parseFloat(cols[3] ?? '');
				const user = cols[0] ?? '';
				const command = cols.slice(10).join(' ');
				if (Number.isNaN(pid)) continue;
				procs.push({
					pid,
					user,
					command,
					cpu: Number.isFinite(cpu) ? cpu : 0,
					mem: Number.isFinite(mem) ? mem : 0,
				});
			}
			return { processes: procs };
		} catch {
			return { processes: [] as ProcessInfo[] };
		}
	},
});
