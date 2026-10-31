import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getConfig } from "../lib/config";
import { getDb, nowIso } from "../db/client";
import { parseStringList } from "../domain/policy";
import type { Role, SessionUser, UserStatus } from "../domain/types";

export const SESSION_COOKIE = "sharespace_session";

type UserRow = {
  id: string;
  institution_id: string;
  email: string;
  display_name: string;
  role: Role;
  status: UserStatus;
  password_hash: string;
  timezone: string;
};

type SessionRow = UserRow & {
  session_created_at: string;
  expires_at: string;
  last_seen_at: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function loadSessionUser(userId: string): SessionUser | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.institution_id, u.email, u.display_name, u.role, u.status, u.password_hash, i.timezone
       FROM users u JOIN institutions i ON i.id = u.institution_id
       WHERE u.id = ?`,
    )
    .get(userId) as UserRow | undefined;
  if (!row) return null;
  const tags = db
    .prepare("SELECT kind, tag FROM user_tags WHERE user_id = ? ORDER BY kind, tag")
    .all(userId) as { kind: "GROUP" | "TRAINING"; tag: string }[];
  return {
    id: row.id,
    institutionId: row.institution_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    groups: tags.filter((t) => t.kind === "GROUP").map((t) => t.tag),
    trainings: tags.filter((t) => t.kind === "TRAINING").map((t) => t.tag),
    timezone: row.timezone,
  };
}

export function getUserById(userId: string): SessionUser | null {
  return loadSessionUser(userId);
}

export type SignInResult =
  | { ok: true; token: string; expiresAt: string; user: SessionUser }
  | { ok: false; reason: "INVALID_CREDENTIALS" | "SUSPENDED" };

export function signIn(email: string, password: string): SignInResult {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.institution_id, u.email, u.display_name, u.role, u.status, u.password_hash, i.timezone
       FROM users u JOIN institutions i ON i.id = u.institution_id
       WHERE lower(u.email) = lower(?) LIMIT 1`,
    )
    .get(email.trim()) as UserRow | undefined;

  if (!row) {
    // Keep timing closer to a real verification without revealing the account.
    bcrypt.compareSync(
      password,
      "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Dg9Q9Q0G6o1o8p1s5J0Yh0q9YJ5Yq",
    );
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const valid = bcrypt.compareSync(password, row.password_hash);
  if (!valid) return { ok: false, reason: "INVALID_CREDENTIALS" };
  if (row.status === "SUSPENDED") return { ok: false, reason: "SUSPENDED" };

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const cfg = getConfig();
  const expiresAt = new Date(now.getTime() + cfg.SESSION_ABSOLUTE_HOURS * 3_600_000);
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    hashToken(token),
    row.id,
    now.toISOString(),
    expiresAt.toISOString(),
    now.toISOString(),
  );

  const user = loadSessionUser(row.id);
  if (!user) return { ok: false, reason: "INVALID_CREDENTIALS" };
  return { ok: true, token, expiresAt: expiresAt.toISOString(), user };
}

export function getSessionUser(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const db = getDb();
  const now = new Date();
  const row = db
    .prepare(
      `SELECT u.id, u.institution_id, u.email, u.display_name, u.role, u.status, u.password_hash,
              i.timezone, s.created_at AS session_created_at, s.expires_at, s.last_seen_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       JOIN institutions i ON i.id = u.institution_id
       WHERE s.token_hash = ?`,
    )
    .get(hashToken(token)) as SessionRow | undefined;
  if (!row) return null;
  if (now.getTime() >= new Date(row.expires_at).getTime()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    return null;
  }
  const cfg = getConfig();
  const idleLimit = cfg.SESSION_IDLE_HOURS * 3_600_000;
  if (now.getTime() - new Date(row.last_seen_at).getTime() > idleLimit) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    return null;
  }
  if (row.status === "SUSPENDED") {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id);
    return null;
  }
  if (now.getTime() - new Date(row.last_seen_at).getTime() > 60_000) {
    db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(
      now.toISOString(),
      hashToken(token),
    );
  }
  return loadSessionUser(row.id);
}

export function revokeSession(token: string | undefined): void {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function revokeAllSessions(userId: string): void {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function findUserRowByEmail(
  email: string,
): { id: string; status: string; institutionId: string } | null {
  const row = getDb()
    .prepare(
      "SELECT id, status, institution_id AS institutionId FROM users WHERE lower(email) = lower(?) LIMIT 1",
    )
    .get(email) as { id: string; status: string; institutionId: string } | undefined;
  return row ?? null;
}

export function touchSession(token: string, userId: string): void {
  getDb()
    .prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ? AND user_id = ?")
    .run(nowIso(), hashToken(token), userId);
}

export function sessionTokenHash(token: string): string {
  return hashToken(token);
}

export function userTags(userId: string): string[] {
  const rows = getDb()
    .prepare("SELECT tag FROM user_tags WHERE user_id = ?")
    .all(userId) as {
    tag: string;
  }[];
  return rows.map((r) => r.tag);
}

export { parseStringList };
