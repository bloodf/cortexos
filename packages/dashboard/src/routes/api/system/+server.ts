import os from 'node:os';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineRoute } from '$lib/server/route-helper';
import type { SystemData, MachineSensor, DriveInfo, MountInfo } from '$lib/types/dashboard';

const execFileAsync = promisify(execFile);

let prevCpu: { total: number; idle: number } | null = null;

function readSys(p: string): string | null {
	try {
		return fs.readFileSync(p, 'utf8').trim();
	} catch {
		return null;
	}
}

function getCpuPercent(): number {
	try {
		const raw = fs.readFileSync('/proc/stat', 'utf8');
		const line = raw.split('\n')[0];
		if (!line) return 0;
		const parts = line.split(/\s+/).slice(1).map((s) => Number.parseInt(s, 10));
		const idle = (parts[3] ?? 0) + (parts[4] ?? 0);
		const total = parts.reduce((a, b) => a + b, 0);
		if (!prevCpu) {
			prevCpu = { total, idle };
			return 0;
		}
		const dTotal = total - prevCpu.total;
		const dIdle = idle - prevCpu.idle;
		prevCpu = { total, idle };
		if (dTotal <= 0) return 0;
		return Math.max(0, Math.min(100, 100 * (1 - dIdle / dTotal)));
	} catch {
		return 0;
	}
}

function getMemory() {
	const total = os.totalmem();
	const free = os.freemem();
	const used = total - free;
	return {
		total,
		used,
		percent: total > 0 ? Math.round((used / total) * 100) : 0,
	};
}

async function getDrives(): Promise<DriveInfo[]> {
	try {
		const { stdout } = await execFileAsync('lsblk', ['-J', '-b', '-o', 'NAME,MODEL,SIZE,TYPE,MOUNTPOINT']);
		const data = JSON.parse(stdout) as { blockdevices?: unknown[] };
		const out: DriveInfo[] = [];
		function walk(nodes: unknown[]) {
			for (const n of nodes) {
				if (!n || typeof n !== 'object') continue;
				const node = n as Record<string, unknown>;
				if (node.type === 'disk') {
					out.push({
						name: `/dev/${String(node.name ?? 'unknown')}`,
						model: String(node.model ?? ''),
						size: Number(node.size) || 0,
					});
				}
				if (Array.isArray(node.children)) walk(node.children);
			}
		}
		if (Array.isArray(data.blockdevices)) walk(data.blockdevices);
		return out;
	} catch {
		return [];
	}
}

async function getMounts(): Promise<MountInfo[]> {
	try {
		const { stdout } = await execFileAsync('df', [
			'-B1',
			'-T',
			'--exclude-type=tmpfs',
			'--exclude-type=devtmpfs',
			'--exclude-type=squashfs',
		]);
		const lines = stdout.trim().split('\n');
		const out: MountInfo[] = [];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;
			const parts = line.trim().split(/\s+/);
			if (parts.length < 7) continue;
			const total = Number(parts[2]);
			const used = Number(parts[3]);
			const free = Number(parts[4]);
			const percentStr = parts[5];
			const mount = parts[6];
			if (!mount) continue;
			const pct = Number(percentStr?.replace('%', ''));
			out.push({
				filesystem: parts[0] ?? '',
				mount,
				total: Number.isFinite(total) ? total : 0,
				used: Number.isFinite(used) ? used : 0,
				free: Number.isFinite(free) ? free : 0,
				percent: Number.isFinite(pct) ? pct : 0,
			});
		}
		return out;
	} catch {
		return [];
	}
}

function getSensors(): SystemData['sensors'] {
	const temperatures: MachineSensor[] = [];
	const fans: MachineSensor[] = [];
	const voltages: MachineSensor[] = [];

	try {
		const zones = fs.readdirSync('/sys/class/thermal');
		for (const z of zones) {
			if (!z.startsWith('thermal_zone')) continue;
			const type = readSys(`/sys/class/thermal/${z}/type`) ?? z;
			const raw = readSys(`/sys/class/thermal/${z}/temp`);
			const val = raw ? Number(raw) / 1000 : NaN;
			if (Number.isFinite(val)) {
				temperatures.push({ id: z, label: type, value: val, unit: 'celsius', source: 'thermal' });
			}
		}
	} catch {}

	try {
		const hwmon = fs.readdirSync('/sys/class/hwmon');
		for (const h of hwmon) {
			const name = readSys(`/sys/class/hwmon/${h}/name`) ?? h;
			const dir = `/sys/class/hwmon/${h}`;
			let entries: string[];
			try {
				entries = fs.readdirSync(dir);
			} catch {
				continue;
			}
			for (const f of entries) {
				const mTemp = /^temp(\d+)_input$/.exec(f);
				if (mTemp) {
					const idx = mTemp[1];
					if (!idx) continue;
					const label = readSys(`${dir}/temp${idx}_label`) ?? `${name} temp${idx}`;
					const raw = readSys(`${dir}/temp${idx}_input`);
					const val = raw ? Number(raw) / 1000 : NaN;
					if (Number.isFinite(val)) {
						temperatures.push({
							id: `${h}-${idx}`,
							label,
							value: val,
							unit: 'celsius',
							source: 'hwmon',
						});
					}
				}
				const mFan = /^fan(\d+)_input$/.exec(f);
				if (mFan) {
					const idx = mFan[1];
					if (!idx) continue;
					const label = readSys(`${dir}/fan${idx}_label`) ?? `${name} fan${idx}`;
					const raw = readSys(`${dir}/fan${idx}_input`);
					const val = raw ? Number(raw) : NaN;
					if (Number.isFinite(val)) {
						fans.push({
							id: `${h}-${idx}`,
							label,
							value: val,
							unit: 'rpm',
							source: 'hwmon',
						});
					}
				}
				const mIn = /^in(\d+)_input$/.exec(f);
				if (mIn) {
					const idx = mIn[1];
					if (!idx) continue;
					const label = readSys(`${dir}/in${idx}_label`) ?? `${name} in${idx}`;
					const raw = readSys(`${dir}/in${idx}_input`);
					const val = raw ? Number(raw) / 1000 : NaN;
					if (Number.isFinite(val)) {
						voltages.push({
							id: `${h}-${idx}`,
							label,
							value: val,
							unit: 'volts',
							source: 'hwmon',
						});
					}
				}
			}
		}
	} catch {}

	const cpuTemperature =
		temperatures.find((t) => /cpu|x86|coretemp|k10temp/i.test(t.label)) ?? temperatures[0] ?? null;
	return { cpuTemperature, temperatures, fans, voltages };
}

async function collectSystem(): Promise<SystemData> {
	const [drives, mounts] = await Promise.all([getDrives(), getMounts()]);
	for (const m of mounts) {
		const d = drives.find((d) => m.filesystem.startsWith(d.name));
		if (d) {
			d.mount = m.mount;
			d.used = m.used;
			d.total = m.total;
			d.percent = m.percent;
		}
	}
	return {
		cpu: getCpuPercent(),
		memory: getMemory(),
		drives,
		mounts,
		load: os.loadavg(),
		uptime: os.uptime(),
		sensors: getSensors(),
	};
}

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'system',
	action: 'system.read',
	handler: async () => collectSystem(),
});
