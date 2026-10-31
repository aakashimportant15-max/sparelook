import { getDb, nowIso } from "../../db/client";
import { newId } from "../../lib/ids";
import type { Role, UserStatus } from "../../domain/types";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  groups: string[];
  trainings: string[];
  createdAt: string;
};

export function listUsers(institutionId: string): AdminUser[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT id, display_name, email, role, status, created_at FROM users WHERE institution_id = ? ORDER BY display_name",
    )
    .all(institutionId) as {
    id: string;
    display_name: string;
    email: string;
    role: Role;
    status: UserStatus;
    created_at: string;
  }[];
  const tagRows = db
    .prepare(
      "SELECT user_id, kind, tag FROM user_tags WHERE institution_id = ? ORDER BY tag",
    )
    .all(institutionId) as { user_id: string; kind: "GROUP" | "TRAINING"; tag: string }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    groups: tagRows
      .filter((t) => t.user_id === row.id && t.kind === "GROUP")
      .map((t) => t.tag),
    trainings: tagRows
      .filter((t) => t.user_id === row.id && t.kind === "TRAINING")
      .map((t) => t.tag),
    createdAt: row.created_at,
  }));
}

export function setUserTags(
  institutionId: string,
  userId: string,
  groups: string[],
  trainings: string[],
): void {
  const db = getDb();
  const user = db
    .prepare("SELECT id FROM users WHERE institution_id = ? AND id = ?")
    .get(institutionId, userId);
  if (!user) throw new Error("User not found");
  const run = db.transaction(() => {
    db.prepare("DELETE FROM user_tags WHERE user_id = ?").run(userId);
    const insert = db.prepare(
      "INSERT INTO user_tags (id, institution_id, user_id, kind, tag, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const stamp = nowIso();
    for (const tag of dedupe(groups)) {
      insert.run(newId("tag"), institutionId, userId, "GROUP", tag, stamp);
    }
    for (const tag of dedupe(trainings)) {
      insert.run(newId("tag"), institutionId, userId, "TRAINING", tag, stamp);
    }
  });
  run();
}

export function setUserStatus(
  institutionId: string,
  userId: string,
  status: UserStatus,
): void {
  getDb()
    .prepare(
      "UPDATE users SET status = ?, updated_at = ? WHERE institution_id = ? AND id = ?",
    )
    .run(status, nowIso(), institutionId, userId);
}

export function getUserSummary(institutionId: string, userId: string) {
  return getDb()
    .prepare(
      "SELECT id, display_name AS name, email, role, status FROM users WHERE institution_id = ? AND id = ?",
    )
    .get(institutionId, userId) as
    | { id: string; name: string; email: string; role: Role; status: UserStatus }
    | undefined;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean))];
}
