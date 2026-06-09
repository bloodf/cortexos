import type { PageServerLoad } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFileAsync = promisify(execFile);

function parseDf(stdout: string): { filesystem: string; size: string; used: string; avail: string; usePercent: string; mount: string } | null {
  const lines = stdout.trim().split('\n');
  if (lines.length < 2) return null;
  const parts = lines[1]!.trim().split(/\s+/);
  if (parts.length < 6) return null;
  return {
    filesystem: parts[0]!,
    size: parts[1]!,
    used: parts[2]!,
    avail: parts[3]!,
    usePercent: parts[4]!,
    mount: parts[5]!,
  };
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const load: PageServerLoad = async () => {
  let disk: { filesystem: string; size: string; used: string; avail: string; usePercent: string; mount: string } | null = null;

  try {
    const { stdout } = await execFileAsync('df', ['-h', '/']);
    disk = parseDf(stdout);
  } catch {
    disk = null;
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    hostname: os.hostname(),
    uptime: formatUptime(os.uptime()),
    loadavg: os.loadavg(),
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      totalFormatted: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      usedFormatted: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeFormatted: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`,
      usePercent: totalMem > 0 ? `${Math.round((usedMem / totalMem) * 100)}%` : '0%',
    },
    disk,
  };
};
