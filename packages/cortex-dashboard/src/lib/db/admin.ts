import { queryOne, execute } from "./client";

export interface PamUser {
  id: number;
  username: string;
  created_at: Date;
}

export interface AdminSession {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
  is_admin: boolean;
}

export async function getOrCreatePamUser(username: string): Promise<PamUser> {
  const normalized = username.trim();
  if (!normalized) throw new Error("Username required");

  const inserted = await queryOne<PamUser>(
    `INSERT INTO pam_users (username)
     VALUES ($1)
     ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
     RETURNING id, username, created_at`,
    [normalized],
  );
  if (!inserted) throw new Error("Failed to get or create PAM user");
  return inserted;
}

export async function createSession(
  userId: number,
  token: string,
  expiresAt: Date,
  isAdmin: boolean = false,
): Promise<AdminSession> {
  const session = await queryOne<AdminSession>(
    "INSERT INTO admin_sessions (user_id, token, expires_at, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, user_id, token, expires_at, created_at, is_admin",
    [userId, token, expiresAt, isAdmin],
  );
  if (!session) throw new Error("Failed to create session");
  return session;
}

export async function getSessionByToken(
  token: string,
): Promise<(AdminSession & { username: string }) | null> {
  return queryOne<AdminSession & { username: string }>(
    `SELECT s.id, s.user_id, s.token, s.expires_at, s.created_at, s.is_admin, u.username
     FROM admin_sessions s
     JOIN pam_users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token],
  );
}

export async function deleteSession(token: string): Promise<void> {
  await execute("DELETE FROM admin_sessions WHERE token = $1", [token]);
}

export async function deleteExpiredSessions(): Promise<void> {
  await execute("DELETE FROM admin_sessions WHERE expires_at <= NOW()");
}

export async function deleteUserSessions(userId: number): Promise<void> {
  await execute("DELETE FROM admin_sessions WHERE user_id = $1", [userId]);
}
