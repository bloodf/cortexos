// @vitest-environment node
/**
 * MP-024b backups bridge tests — listBackupRuns parses backup archive files and
 * leftover staging directories through a swappable root + executor seam.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  listBackupRuns,
  setBackupExecutorForTests,
  setBackupsRootForTests,
  resetBackupsForTests,
  type BackupExecutor,
} from "@/server/backups";

beforeEach(() => {
  resetBackupsForTests();
});

function makeRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "backups-test-"));
}

function mockExecutor(envStdout: string, stateStdout: string): BackupExecutor {
  return async (argv) => {
    const cmd = argv.join(" ");
    if (cmd.includes("Environment")) {
      return { stdout: envStdout, stderr: "", exitCode: 0 };
    }
    if (cmd.includes("ActiveState")) {
      return { stdout: stateStdout, stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

describe("listBackupRuns", () => {
  it("maps successful archives and failed staging directories to contract rows", async () => {
    const root = makeRoot();
    // Discovered source: successful encrypted archives.
    writeFileSync(path.join(root, "2026-06-03_1200.tar.gz.age"), "encrypted-archive-data");
    writeFileSync(path.join(root, "2026-06-04_0000.tar.gz.age"), "encrypted-archive-data-2");
    // Discovered source: failed runs leave staging directories behind.
    mkdirSync(path.join(root, "2026-06-10_1200"));
    // Ignored noise.
    writeFileSync(path.join(root, "README.txt"), "ignore me");

    setBackupExecutorForTests(
      mockExecutor(
        `Environment=BACKUP_ROOT=${root}`,
        "failed\nfailed\nThu 2026-06-11 12:09:31 UTC",
      ),
    );

    const rows = await listBackupRuns();

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id)).toEqual([
      "2026-06-10_1200",
      "2026-06-04_0000",
      "2026-06-03_1200",
    ]);

    const success = rows.find((r) => r.id === "2026-06-03_1200")!;
    expect(success.status).toBe("success");
    expect(success.sizeBytes).toBe(22);
    expect(success.timestamp).toBe("2026-06-03T12:00:00.000Z");
    expect(success.target).toBe(path.join(root, "2026-06-03_1200.tar.gz.age"));

    const failed = rows.find((r) => r.id === "2026-06-10_1200")!;
    expect(failed.status).toBe("failed");
    expect(failed.sizeBytes).toBeNull();
    expect(failed.target).toBe(path.join(root, "2026-06-10_1200"));
  });

  it("marks the latest in-progress directory as running when the service is active", async () => {
    const root = makeRoot();
    writeFileSync(path.join(root, "2026-06-09_1200.tar.gz.age"), "encrypted-archive-data");
    mkdirSync(path.join(root, "2026-06-10_1200"));

    setBackupExecutorForTests(mockExecutor(`Environment=BACKUP_ROOT=${root}`, "active\nrunning\n"));

    const rows = await listBackupRuns();
    const current = rows.find((r) => r.id === "2026-06-10_1200")!;
    expect(current.status).toBe("running");
    expect(current.sizeBytes).toBeNull();

    const previous = rows.find((r) => r.id === "2026-06-09_1200")!;
    expect(previous.status).toBe("success");
  });

  it("returns an empty array when the backup root is missing", async () => {
    setBackupExecutorForTests(
      mockExecutor("Environment=BACKUP_ROOT=/does/not/exist", "inactive\ndead\n"),
    );
    const rows = await listBackupRuns();
    expect(rows).toEqual([]);
  });

  it("returns an empty array when the executor exits non-zero and the fallback root is empty", async () => {
    const root = makeRoot();
    writeFileSync(path.join(root, "2026-06-03_1200.tar.gz.age"), "encrypted-archive-data");
    setBackupExecutorForTests(async () => ({
      stdout: "",
      stderr: "systemctl unavailable",
      exitCode: 1,
    }));
    setBackupsRootForTests("/does/not/exist");

    const rows = await listBackupRuns();
    expect(rows).toEqual([]);
  });
});
