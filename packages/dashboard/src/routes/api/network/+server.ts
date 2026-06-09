import fs from 'node:fs';
import { defineRoute } from '$lib/server/route-helper';
import type { NetworkData, NetworkInterface } from '$lib/types/dashboard';

// Physical NIC test: /sys/class/net/<iface>/device exists only for real hardware.
function isPhysicalInterface(name: string): boolean {
  try {
    fs.accessSync(`/sys/class/net/${name}/device`);
    return true;
  } catch {
    return false;
  }
}

interface Sample {
	rx: number;
	tx: number;
	ts: number;
}

const prev = new Map<string, Sample>();

export const GET = defineRoute({
	methods: ['GET'],
	auth: 'any',
	surface: 'system',
	action: 'network.read',
	handler: async () => {
		try {
			const raw = fs.readFileSync('/proc/net/dev', 'utf8');
			const lines = raw.split('\n');
			const interfaces: NetworkInterface[] = [];
			for (let i = 2; i < lines.length; i++) {
				const line = lines[i];
				if (!line) continue;
				const [namePart, dataPart] = line.split(':');
				if (!namePart || !dataPart) continue;
				const name = namePart.trim();
				if (!isPhysicalInterface(name)) continue;
				const cols = dataPart.trim().split(/\s+/).map((s) => Number.parseInt(s, 10));
				const rx = cols[0] ?? 0;
				const tx = cols[8] ?? 0;
				const now = Date.now();
				const last = prev.get(name);
				let rxKbps = 0;
				let txKbps = 0;
				if (last) {
					const sec = Math.max(1, (now - last.ts) / 1000);
					rxKbps = Math.max(0, (rx - last.rx) / 1024 / sec);
					txKbps = Math.max(0, (tx - last.tx) / 1024 / sec);
				}
				prev.set(name, { rx, tx, ts: now });
				interfaces.push({
					name,
					rxKbps,
					txKbps,
					rxBytesTotal: rx,
					txBytesTotal: tx,
				});
			}
			return { interfaces } satisfies NetworkData;
		} catch {
			return { interfaces: [] as NetworkInterface[] };
		}
	},
});
