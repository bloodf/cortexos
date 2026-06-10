/**
 * Processes reader — WP-14.
 *
 * Runs `ps aux --no-header` and parses the output into ProcessInfo rows.
 * Returns an empty array on any error (non-Linux, ps not found, etc.).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ProcessInfo } from "./types";

const execFileAsync = promisify(execFile);

/**
 * Read the running process list via `ps aux --no-header`.
 * Column layout: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND...
 *   [0]  [1]  [2]   [3]  [4] [5] [6] [7]  [8]  [9]  [10+]
 */
export async function readProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execFileAsync("ps", ["aux", "--no-header"], {
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const lines = stdout.trim().split("\n");
    const procs: ProcessInfo[] = [];
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 11) continue;
      const pid = Number.parseInt(cols[1] ?? "", 10);
      const cpu = Number.parseFloat(cols[2] ?? "");
      const mem = Number.parseFloat(cols[3] ?? "");
      const user = cols[0] ?? "";
      const command = cols.slice(10).join(" ");
      if (Number.isNaN(pid)) continue;
      procs.push({
        pid,
        user,
        command,
        cpu: Number.isFinite(cpu) ? cpu : 0,
        mem: Number.isFinite(mem) ? mem : 0,
      });
    }
    return procs;
  } catch {
    return [];
  }
}
