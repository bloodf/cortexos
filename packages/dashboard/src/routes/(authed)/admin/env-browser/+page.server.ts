/**
 * /admin/env-browser — list allowlisted env files.
 */
import type { PageServerLoad } from './$types';
import { readdir } from 'node:fs/promises';

const ALLOWED_DIRS = ['/opt/cortexos/.secrets/', '/opt/cortexos/stacks/'];

export interface EnvFile {
	path: string;
	name: string;
}

async function scanEnvFiles(): Promise<EnvFile[]> {
	const files: EnvFile[] = [];
	for (const dir of ALLOWED_DIRS) {
		try {
			const entries = await readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.isFile() && (entry.name.endsWith('.env') || entry.name.includes('env'))) {
					files.push({ path: `${dir}${entry.name}`, name: entry.name });
				}
			}
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT' && code !== 'ENOTDIR' && code !== 'EACCES' && code !== 'ENODEV') {
				console.error('Env browser scan error:', err);
			}
		}
	}
	return files.sort((a, b) => a.name.localeCompare(b.name));
}

export const load: PageServerLoad = async () => {
	const files = await scanEnvFiles();
	return { files };
};
