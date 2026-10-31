import { getDb, nowIso } from "../../db/client";
import { newId } from "../../lib/ids";
import { parseStringList } from "../../domain/policy";
import type { Resource, ResourceStatus } from "../../domain/types";

type ResourceRow = {
  id: string;
  institution_id: string;
  owner_id: string;
  owner_name: string | null;
  name: string;
  type: string;
  category: string;
  asset_tag: string;
  location: string;
  description: string;
  accessories: string;
  status: ResourceStatus;
  approval_required: number;
  max_duration_hours: number;
  open_time: string | null;
  close_time: string | null;
  allowed_groups: string;
  required_trainings: string;
  created_at: string;
  updated_at: string;
};

export function mapResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    institutionId: row.institution_id,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? undefined,
    name: row.name,
    type: row.type,
    category: row.category,
    assetTag: row.asset_tag,
    location: row.location,
    description: row.description,
    accessories: parseStringList(row.accessories),
    status: row.status,
    approvalRequired: row.approval_required === 1,
    maxDurationHours: row.max_duration_hours,
    openTime: row.open_time,
    closeTime: row.close_time,
    allowedGroups: parseStringList(row.allowed_groups),
    requiredTrainings: parseStringList(row.required_trainings),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BASE_SELECT = `SELECT r.*, u.display_name AS owner_name
  FROM resources r JOIN users u ON u.id = r.owner_id`;

export type ResourceFilter = {
  institutionId: string;
  q?: string;
  type?: string;
  location?: string;
  includeHidden?: boolean;
  status?: ResourceStatus;
  limit?: number;
  offset?: number;
};

export function listResources(filter: ResourceFilter): {
  items: Resource[];
  total: number;
} {
  const clauses = ["r.institution_id = ?"];
  const params: unknown[] = [filter.institutionId];
  if (filter.status) {
    clauses.push("r.status = ?");
    params.push(filter.status);
  } else if (!filter.includeHidden) {
    clauses.push("r.status IN ('ACTIVE', 'MAINTENANCE')");
  }
  if (filter.q) {
    clauses.push(
      "(lower(r.name) LIKE ? OR lower(r.description) LIKE ? OR lower(r.asset_tag) LIKE ? OR lower(r.allowed_groups) LIKE ?)",
    );
    const term = `%${filter.q.toLowerCase()}%`;
    params.push(term, term, term, term);
  }
  if (filter.type) {
    clauses.push("r.type = ?");
    params.push(filter.type);
  }
  if (filter.location) {
    clauses.push("lower(r.location) LIKE ?");
    params.push(`%${filter.location.toLowerCase()}%`);
  }
  const where = clauses.join(" AND ");
  const db = getDb();
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM resources r WHERE ${where}`)
    .get(...params) as { count: number };
  const rows = db
    .prepare(`${BASE_SELECT} WHERE ${where} ORDER BY r.name ASC LIMIT ? OFFSET ?`)
    .all(...params, filter.limit ?? 12, filter.offset ?? 0) as ResourceRow[];
  return { items: rows.map(mapResource), total: total.count };
}

export function getResourceById(institutionId: string, id: string): Resource | null {
  const row = getDb()
    .prepare(`${BASE_SELECT} WHERE r.institution_id = ? AND r.id = ?`)
    .get(institutionId, id) as ResourceRow | undefined;
  return row ? mapResource(row) : null;
}

export function listOwnerOptions(institutionId: string): { id: string; name: string }[] {
  return getDb()
    .prepare(
      "SELECT id, display_name AS name FROM users WHERE institution_id = ? AND role IN ('OWNER','ADMIN') ORDER BY display_name",
    )
    .all(institutionId) as { id: string; name: string }[];
}

export type ResourceInput = {
  name: string;
  type: string;
  assetTag: string;
  location: string;
  description: string;
  accessories: string[];
  maxDurationHours: number;
  approvalRequired: boolean;
  openTime: string | null;
  closeTime: string | null;
  allowedGroups: string[];
  requiredTrainings: string[];
  ownerId: string;
};

export function createResource(institutionId: string, input: ResourceInput): Resource {
  const db = getDb();
  const id = newId("res");
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO resources (id, institution_id, owner_id, name, type, category, asset_tag, location, description,
      accessories, status, approval_required, max_duration_hours, open_time, close_time, allowed_groups,
      required_trainings, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'cameras_technical', ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    institutionId,
    input.ownerId,
    input.name,
    input.type,
    input.assetTag,
    input.location,
    input.description,
    JSON.stringify(input.accessories),
    input.approvalRequired ? 1 : 0,
    input.maxDurationHours,
    input.openTime,
    input.closeTime,
    JSON.stringify(input.allowedGroups),
    JSON.stringify(input.requiredTrainings),
    timestamp,
    timestamp,
  );
  const created = getResourceById(institutionId, id);
  if (!created) throw new Error("Resource insert failed");
  return created;
}

export function updateResource(
  institutionId: string,
  id: string,
  input: Partial<ResourceInput>,
): Resource {
  const current = getResourceById(institutionId, id);
  if (!current) throw new Error("Resource not found");
  const db = getDb();
  db.prepare(
    `UPDATE resources SET
      name = ?, type = ?, asset_tag = ?, location = ?, description = ?, accessories = ?,
      max_duration_hours = ?, approval_required = ?, open_time = ?, close_time = ?,
      allowed_groups = ?, required_trainings = ?, owner_id = ?, updated_at = ?
     WHERE institution_id = ? AND id = ?`,
  ).run(
    input.name ?? current.name,
    input.type ?? current.type,
    input.assetTag ?? current.assetTag,
    input.location ?? current.location,
    input.description ?? current.description,
    JSON.stringify(input.accessories ?? current.accessories),
    input.maxDurationHours ?? current.maxDurationHours,
    (input.approvalRequired ?? current.approvalRequired) ? 1 : 0,
    input.openTime !== undefined ? input.openTime : current.openTime,
    input.closeTime !== undefined ? input.closeTime : current.closeTime,
    JSON.stringify(input.allowedGroups ?? current.allowedGroups),
    JSON.stringify(input.requiredTrainings ?? current.requiredTrainings),
    input.ownerId ?? current.ownerId,
    nowIso(),
    institutionId,
    id,
  );
  const updated = getResourceById(institutionId, id);
  if (!updated) throw new Error("Resource update failed");
  return updated;
}

export function setResourceStatus(
  institutionId: string,
  id: string,
  status: ResourceStatus,
): Resource {
  getDb()
    .prepare(
      "UPDATE resources SET status = ?, updated_at = ? WHERE institution_id = ? AND id = ?",
    )
    .run(status, nowIso(), institutionId, id);
  const updated = getResourceById(institutionId, id);
  if (!updated) throw new Error("Resource not found");
  return updated;
}

export function busyBlocks(
  resourceId: string,
  fromIso: string,
  toIso: string,
): { startAt: string; endAt: string }[] {
  return getDb()
    .prepare(
      `SELECT start_at AS startAt, end_at AS endAt FROM bookings
       WHERE resource_id = ? AND status IN ('APPROVED', 'CHECKED_OUT')
         AND start_at < ? AND end_at > ?
       ORDER BY start_at`,
    )
    .all(resourceId, toIso, fromIso) as { startAt: string; endAt: string }[];
}
