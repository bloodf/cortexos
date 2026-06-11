/**
 * Backups bridge — server-side reader for CortexOS backup run state (MP-024b).
 *
 * Discovers backup runs from the configured BACKUP_ROOT. Successful runs are
 * represented by encrypted archive files (`YYYY-MM-DD_HHMM.tar.gz.age`); failed
 * runs leave behind a staging directory with the same basename. The live
 * BACKUP_ROOT is read from the installed `cortex-backup.service` Environment.
 *
 * Public surface:
 *   - listBackupRuns()                     → BackupRunRow[]
 *   - setBackupExecutorForTests(fn)        → test helper
 *   - setBackupsRootForTests(root)         → test helper
 *   - resetBackupsForTests()               → test helper
 */

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Executor interface — seam between tests (mock) and production (systemctl).
// ---------------------------------------------------------------------------

export interface BackupExecutorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type BackupExecutor = (argv: readonly string[]) => Promise<BackupExecutorResult>;

// ---------------------------------------------------------------------------
// Real executor (Linux only) — execFile with fixed argv, no shell.
// ---------------------------------------------------------------------------

const realBackupExecutor: BackupExecutor = async (argv) => {
  try {
    const { stdout, stderr } = await execFileAsync("/usr/bin/systemctl", argv as string[], {
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { stdout: stdout ?? "", stderr: stderr ?? "", exitCode: 0 };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "systemctl exec failed",
      exitCode: typeof e.code === "number" ? e.code : 1,
    };
  }
};

// ---------------------------------------------------------------------------
// Mock executor (non-Linux/CI) — deterministic empty fallback.
// ---------------------------------------------------------------------------

const emptyMockExecutor: BackupExecutor = async () => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
});

// ---------------------------------------------------------------------------
// Module-level state — executor and root are the only swappable pieces.
// ---------------------------------------------------------------------------

let backupExecutor: BackupExecutor = () => {
  throw new Error("backups bridge: executor used before init");
};
let backupsRoot = "/mnt/hdd/backups";

(function init() {
  const useReal = process.platform === "linux" && process.env.CORTEX_BACKUPS_BRIDGE_REAL !== "0";
  backupExecutor = useReal ? realBackupExecutor : emptyMockExecutor;
})();

/** Test helper: swap the systemctl executor. Pass `null` to reset to the empty mock. */
export function setBackupExecutorForTests(fn: BackupExecutor | null): void {
  backupExecutor = fn ?? emptyMockExecutor;
}

/** Test helper: swap the backup root directory. */
export function setBackupsRootForTests(root: string): void {
  backupsRoot = root;
}

/** Reset the bridge to the empty mock executor and default root. */
export function resetBackupsForTests(): void {
  backupExecutor = emptyMockExecutor;
  backupsRoot = "/mnt/hdd/backups";
}

// ---------------------------------------------------------------------------
// Row contract exposed to server functions.
// ---------------------------------------------------------------------------

export interface BackupRunRow {
  /** Run identifier derived from the archive/directory basename (e.g. `2026-06-03_1200`). */
  id: string;
  /** ISO-8601 timestamp parsed from the run identifier. */
  timestamp: string;
  /** Absolute path to the archive file or staging directory. */
  target: string;
  /** Size of the encrypted archive in bytes, or `null` for failed/incomplete runs. */
  sizeBytes: number | null;
  /** High-level result of the backup run. */
  status: "success" | "failed" | "running" | "unknown";
}

// ---------------------------------------------------------------------------
// Helpers — environment resolution, parsing, status mapping.
// ---------------------------------------------------------------------------

const STAMP_RE = /^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})$/;
const ARCHIVE_RE = /^(\d{4}-\d{2}-\d{2}_\d{4})\.tar\.gz(\.age)?$/;

function parseStamp(stamp: string): string | null {
  const m = STAMP_RE.exec(stamp);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00.000Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return iso;
}

function parseEnvironment(stdout: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("Environment=")) continue;
    const assignments = trimmed.slice("Environment=".length).trim();
    for (const pair of assignments.split(/\s+/)) {
      const idx = pair.indexOf("=");
      if (idx === -1) continue;
      env[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  }
  return env;
}

async function resolveBackupRoot(): Promise<string> {
  const envRoot = process.env.CORTEX_BACKUP_ROOT;
  if (envRoot) return envRoot;

  const result = await backupExecutor(["show", "cortex-backup.service", "--property=Environment"]);
  if (result.exitCode === 0) {
    const env = parseEnvironment(result.stdout);
    if (env.BACKUP_ROOT) return env.BACKUP_ROOT;
  }

  return backupsRoot;
}

async function getServiceState(name: string): Promise<BackupRunRow["status"]> {
  const result = await backupExecutor([
    "show",
    name,
    "--property=ActiveState,SubState,StateChangeTimestamp",
    "--value",
  ]);
  if (result.exitCode !== 0) return "unknown";

  const lines = result.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const activeState = lines[0] ?? "";
  const subState = lines[1] ?? "";

  if (activeState === "active") return "running";
  if (activeState === "failed" || subState === "failed") return "failed";
  return "unknown";
}

interface RunEntry {
  stamp: string;
  timestamp: string;
  filePath: string;
  isFile: boolean;
  sizeBytes: number | null;
}

async function scanRuns(root: string): Promise<RunEntry[]> {
  const runs = new Map<string, RunEntry>();

  let entries: string[] = [];
  try {
    entries = await readdir(root);
  } catch {
    return [];
  }

  for (const name of entries) {
    const filePath = path.join(root, name);
    const st = await stat(filePath).catch(() => null);
    if (!st) continue;

    const archiveMatch = ARCHIVE_RE.exec(name);
    if (archiveMatch) {
      const stamp = archiveMatch[1]!;
      const timestamp = parseStamp(stamp);
      if (!timestamp) continue;
      runs.set(stamp, {
        stamp,
        timestamp,
        filePath,
        isFile: true,
        sizeBytes: st.size,
      });
      continue;
    }

    const timestamp = parseStamp(name);
    if (!timestamp || !st.isDirectory()) continue;

    if (!runs.has(name)) {
      runs.set(name, {
        stamp: name,
        timestamp,
        filePath,
        isFile: false,
        sizeBytes: null,
      });
    }
  }

  return Array.from(runs.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ---------------------------------------------------------------------------
// Loader — parses backup archive files and staging directories.
// ---------------------------------------------------------------------------

/** List all discovered backup runs mapped to the fixed row contract. */
export async function listBackupRuns(): Promise<BackupRunRow[]> {
  const root = await resolveBackupRoot();
  const serviceState = await getServiceState("cortex-backup.service");
  const scanned = await scanRuns(root);

  const rows: BackupRunRow[] = scanned.map((entry): BackupRunRow => {
    let status: BackupRunRow["status"] = entry.isFile ? "success" : "failed";
    if (!entry.isFile && serviceState === "running" && entry === scanned[0]) {
      status = "running";
    }
    return {
      id: entry.stamp,
      timestamp: entry.timestamp,
      target: entry.filePath,
      sizeBytes: entry.sizeBytes,
      status,
    };
  });

  return rows;
}
