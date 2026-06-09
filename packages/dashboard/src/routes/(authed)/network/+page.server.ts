import type { PageServerLoad } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import type { NetworkInterface } from '$lib/types/dashboard';

const execFileAsync = promisify(execFile);

interface IpAddrInfo {
  family: string;
  local: string;
  prefixlen?: number;
}

interface IpInterface {
  ifindex: number;
  ifname: string;
  flags?: string[];
  operstate?: string;
  addr_info?: IpAddrInfo[];
}

interface ListeningPort {
  state: string;
  recvQ: string;
  sendQ: string;
  localAddress: string;
  localPort: string;
  peerAddress: string;
  process: string;
}

interface Sample {
  rx: number;
  tx: number;
  ts: number;
}

const prev = new Map<string, Sample>();

// An interface is physical iff /sys/class/net/<iface>/device exists (real PCI/USB NIC).
// Virtual interfaces (veth*, docker*, br-*, virbr*, incusbr*, tailscale*, wg*, vnet*, cni*, kube*, lo)
// have no device symlink.
function isPhysicalInterface(name: string): boolean {
  try {
    fs.accessSync(`/sys/class/net/${name}/device`);
    return true;
  } catch {
    return false;
  }
}

function parseSs(stdout: string): ListeningPort[] {
  const lines = stdout.trim().split('\n');
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const m = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+):(\d+)\s+(\S+)\s+(.*)$/.exec(line.trim());
    if (!m) return null;
    return {
      state: m[1],
      recvQ: m[2],
      sendQ: m[3],
      localAddress: m[4],
      localPort: m[5],
      peerAddress: m[6]!,
      process: m[7]!.trim(),
    };
  }).filter(Boolean) as ListeningPort[];
}

function getNetworkStats(): NetworkInterface[] {
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
    return interfaces;
  } catch {
    return [];
  }
}

export const load: PageServerLoad = async () => {
  let interfaces: IpInterface[] = [];
  let ports: ListeningPort[] = [];

  try {
    const { stdout } = await execFileAsync('ip', ['-j', 'addr']);
    const parsed = JSON.parse(stdout) as IpInterface[];
    interfaces = Array.isArray(parsed)
      ? parsed.filter((i) => isPhysicalInterface(i.ifname))
      : [];
  } catch {
    interfaces = [];
  }

  try {
    const { stdout } = await execFileAsync('ss', ['-tlnp']);
    ports = parseSs(stdout);
  } catch {
    ports = [];
  }

  const networkStats = getNetworkStats();

  return { interfaces, ports, networkStats };
};
