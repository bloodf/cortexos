import type { PageServerLoad } from './$types';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SystemdTimer {
  unit: string;
  next: string;
  left: string;
  last: string;
  passed: string;
  activates: string;
}

export interface CronJob {
  line: string;
  isComment: boolean;
}

async function loadTimers(): Promise<SystemdTimer[]> {
  try {
    const { stdout } = await execFileAsync(
      'systemctl',
      ['list-timers', '--all', '--no-pager', '--no-legend'],
      { timeout: 5000 },
    );
    return stdout
      .trim()
      .split('\n')
      .map((line) => {
        const parts = line.trim().split(/\s{2,}/);
        if (parts.length < 5) return null;
        return {
          unit: parts[0] ?? '',
          next: parts[1] ?? '',
          left: parts[2] ?? '',
          last: parts[3] ?? '',
          passed: parts[4] ?? '',
          activates: parts[5] ?? '',
        };
      })
      .filter(Boolean) as SystemdTimer[];
  } catch {
    return [];
  }
}

async function loadCronJobs(): Promise<CronJob[]> {
  try {
    const { stdout } = await execFileAsync('crontab', ['-l'], { timeout: 3000 });
    return stdout
      .trim()
      .split('\n')
      .map((line) => ({
        line: line.trim(),
        isComment: line.trim().startsWith('#') || line.trim() === '',
      }));
  } catch {
    return [];
  }
}

export const load: PageServerLoad = async () => {
  const [timers, cronJobs] = await Promise.all([loadTimers(), loadCronJobs()]);
  return { timers, cronJobs };
};
