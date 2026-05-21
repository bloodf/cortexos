import { query, queryOne } from "./client";

export interface ActionLogEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  target_type: ActionTargetType;
  target_name: string;
  action: string;
  status: "success" | "failure";
  message: string | null;
  created_at: Date;
}

export type ActionTargetType = "docker" | "systemd" | "updates" | "local-user" | "mail-guardian";
export type ActionStatus = "success" | "failure";

export async function createActionLog(data: {
  user_id?: number | null;
  username?: string | null;
  target_type: ActionTargetType;
  target_name: string;
  action: string;
  status: ActionStatus;
  message?: string | null;
}): Promise<ActionLogEntry> {
  const entry = await queryOne<ActionLogEntry>(
    `INSERT INTO action_log (user_id, username, target_type, target_name, action, status, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, username, target_type, target_name, action, status, message, created_at`,
    [
      data.user_id ?? null,
      data.username ?? null,
      data.target_type,
      data.target_name,
      data.action,
      data.status,
      data.message ?? null,
    ],
  );
  if (!entry) throw new Error("Failed to insert action log");
  return entry;
}

export async function getActionLog(limit = 100): Promise<ActionLogEntry[]> {
  const clamped = Math.min(Math.max(limit, 1), 500);
  return query<ActionLogEntry>(
    `SELECT id, user_id, username, target_type, target_name, action, status, message, created_at
     FROM action_log
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [clamped],
  );
}
