/**
 * Backups — server functions (MP-024b).
 *
 * Transport is createServerFn RPC (ADR-001). The gate carries auth/RBAC/audit
 * and dynamically imports the server-only backups bridge so the client bundle
 * never pulls in `src/server/**`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { defineServerFn, serverFnNoop } from "@/lib/api/define-server-fn";
import type { BackupSnapshot } from "@/mocks/types";
import type { BackupRunRow } from "@/server/backups";

function toBackupSnapshot(row: BackupRunRow): BackupSnapshot {
  let status: BackupSnapshot["status"];
  switch (row.status) {
    case "success":
      status = "ok";
      break;
    case "running":
      status = "running";
      break;
    case "failed":
    case "unknown":
    default:
      status = "failed";
      break;
  }

  return {
    id: row.id,
    target: row.target,
    kind: "zfs",
    createdAt: row.timestamp,
    sizeBytes: row.sizeBytes ?? 0,
    retained: 0,
    status,
  };
}

// ---------------------------------------------------------------------------
// listBackupRuns — GET, auth: any → { backups: BackupSnapshot[] }
// ---------------------------------------------------------------------------

const listBackupRunsGate = defineServerFn({
  method: "GET",
  auth: "any",
  input: z.object({}).strict(),
  surface: "backups",
  action: "backups.list",
  handler: async () => {
    const { listBackupRuns: listBackupRunsBridge } = await import("@/server/backups");
    const rows = (await listBackupRunsBridge()) as BackupRunRow[];
    const backups = rows.map(toBackupSnapshot);
    return { backups };
  },
});

export const listBackupRuns = createServerFn({ method: "GET" })
  .middleware([listBackupRunsGate])
  .handler(serverFnNoop);

export type { BackupSnapshot };
