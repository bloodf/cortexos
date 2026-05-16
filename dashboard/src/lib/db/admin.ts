import { query, queryOne, execute } from "./client";

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  is_admin: boolean;
  created_at: Date;
}

export interface AdminSession {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}


export async function countAdminUsers(): Promise<number> {
  const row = await queryOne<{ count: string }>("SELECT COUNT(*)::text AS count FROM admin_users");
  return Number(row?.count ?? 0);
}
export async function getUserByUsername(
  username: string,
): Promise<AdminUser | null> {
  return queryOne<AdminUser>(
    "SELECT id, username, password_hash, is_admin, created_at FROM admin_users WHERE username = $1",
    [username],
  );
}

export async function getUserById(id: number): Promise<AdminUser | null> {
  return queryOne<AdminUser>(
    "SELECT id, username, password_hash, is_admin, created_at FROM admin_users WHERE id = $1",
    [id],
  );
}

export async function createUser(
  username: string,
  passwordHash: string,
  isAdmin: boolean = false,
): Promise<AdminUser> {
  const user = await queryOne<AdminUser>(
    "INSERT INTO admin_users (username, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING id, username, password_hash, is_admin, created_at",
    [username, passwordHash, isAdmin],
  );
  if (!user) throw new Error("Failed to create user");
  return user;
}

export async function setUserAdmin(id: number, isAdmin: boolean): Promise<void> {
  await execute("UPDATE admin_users SET is_admin = $1 WHERE id = $2", [isAdmin, id]);
}

export async function updateUserPassword(
  id: number,
  passwordHash: string,
): Promise<void> {
  await execute(
    "UPDATE admin_users SET password_hash = $1 WHERE id = $2",
    [passwordHash, id],
  );
}

export async function deleteUser(id: number): Promise<void> {
  await execute("DELETE FROM admin_users WHERE id = $1", [id]);
}

export async function createSession(
  userId: number,
  token: string,
  expiresAt: Date,
): Promise<AdminSession> {
  const session = await queryOne<AdminSession>(
    "INSERT INTO admin_sessions (user_id, token, expires_at) VALUES ($1, $2, $3) RETURNING id, user_id, token, expires_at, created_at",
    [userId, token, expiresAt],
  );
  if (!session) throw new Error("Failed to create session");
  return session;
}

export async function getSessionByToken(
  token: string,
): Promise<(AdminSession & { username: string; is_admin: boolean }) | null> {
  return queryOne<AdminSession & { username: string; is_admin: boolean }>(
    `SELECT s.id, s.user_id, s.token, s.expires_at, s.created_at, u.username, u.is_admin
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.user_id
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
