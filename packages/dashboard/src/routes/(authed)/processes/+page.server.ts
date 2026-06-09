import type { PageServerLoad } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function parsePs(stdout: string): Array<{ pid: string; ppid: string; user: string; cpu: string; mem: string; comm: string; args: string }> {
  return stdout.trim().split('\n').slice(1).map(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.*)$/.exec(line.trim());
    if (!m) return null;
    return { pid: m[1], ppid: m[2], user: m[3], cpu: m[4], mem: m[5], comm: m[6], args: m[7] };
  }).filter(Boolean) as any;
}

export const load: PageServerLoad = async () => {
  let processes: Array<{ pid: string; ppid: string; user: string; cpu: string; mem: string; comm: string; args: string }> = [];

  try {
    const { stdout } = await execFileAsync('ps', ['-eo', 'pid,ppid,user,%cpu,%mem,comm,args', '--sort=-%cpu']);
    processes = parsePs(stdout).slice(0, 30);
  } catch {
    processes = [];
  }

  return { processes };
};
