import { getDb, nowIso } from "../../db/client";
import { newId } from "../../lib/ids";
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  Role,
} from "../../domain/types";

type IncidentRow = {
  id: string;
  institution_id: string;
  resource_id: string;
  resource_name: string;
  resource_owner_id: string;
  booking_id: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    institutionId: row.institution_id,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    bookingId: row.booking_id,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name ?? undefined,
    type: row.type,
    severity: row.severity,
    description: row.description,
    status: row.status,
    resolutionNote: row.resolution_note,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BASE_SELECT = `SELECT i.*, r.name AS resource_name, r.owner_id AS resource_owner_id,
    u.display_name AS reporter_name
  FROM incidents i
  JOIN resources r ON r.id = i.resource_id
  LEFT JOIN users u ON u.id = i.reporter_id`;

export function getIncident(institutionId: string, id: string): Incident | null {
  const row = getDb()
    .prepare(`${BASE_SELECT} WHERE i.institution_id = ? AND i.id = ?`)
    .get(institutionId, id) as IncidentRow | undefined;
  return row ? mapIncident(row) : null;
}

export function getIncidentResourceOwner(incidentId: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT r.owner_id FROM incidents i JOIN resources r ON r.id = i.resource_id WHERE i.id = ?",
    )
    .get(incidentId) as { owner_id: string } | undefined;
  return row?.owner_id ?? null;
}

export function listIncidents(options: {
  institutionId: string;
  viewerId: string;
  viewerRole: Role;
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  resourceId?: string;
  bookingId?: string;
  limit?: number;
}): Incident[] {
  const clauses = ["i.institution_id = ?"];
  const params: unknown[] = [options.institutionId];
  if (options.viewerRole === "BORROWER") {
    clauses.push("(i.reporter_id = ? OR b.requester_id = ?)");
    params.push(options.viewerId, options.viewerId);
  } else if (options.viewerRole === "OWNER") {
    clauses.push("(r.owner_id = ? OR i.reporter_id = ? OR b.requester_id = ?)");
    params.push(options.viewerId, options.viewerId, options.viewerId);
  }
  if (options.status) {
    clauses.push("i.status = ?");
    params.push(options.status);
  }
  if (options.severity) {
    clauses.push("i.severity = ?");
    params.push(options.severity);
  }
  if (options.resourceId) {
    clauses.push("i.resource_id = ?");
    params.push(options.resourceId);
  }
  if (options.bookingId) {
    clauses.push("i.booking_id = ?");
    params.push(options.bookingId);
  }
  const rows = getDb()
    .prepare(
      `SELECT i.*, r.name AS resource_name, r.owner_id AS resource_owner_id,
              u.display_name AS reporter_name
       FROM incidents i
       JOIN resources r ON r.id = i.resource_id
       LEFT JOIN users u ON u.id = i.reporter_id
       LEFT JOIN bookings b ON b.id = i.booking_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY CASE i.severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
                i.created_at DESC
       LIMIT ?`,
    )
    .all(...params, options.limit ?? 100) as IncidentRow[];
  return rows.map(mapIncident);
}

export function incidentsForBooking(bookingId: string): Incident[] {
  const rows = getDb()
    .prepare(
      `SELECT i.*, r.name AS resource_name, r.owner_id AS resource_owner_id,
              u.display_name AS reporter_name
       FROM incidents i JOIN resources r ON r.id = i.resource_id
       LEFT JOIN users u ON u.id = i.reporter_id
       WHERE i.booking_id = ? ORDER BY i.created_at`,
    )
    .all(bookingId) as IncidentRow[];
  return rows.map(mapIncident);
}

export function insertIncident(input: {
  institutionId: string;
  resourceId: string;
  bookingId: string | null;
  reporterId: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status?: IncidentStatus;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
}): Incident {
  const id = newId("inc");
  const stamp = nowIso();
  getDb()
    .prepare(
      `INSERT INTO incidents (id, institution_id, resource_id, booking_id, reporter_id, type, severity,
        description, status, resolution_note, resolved_by, resolved_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.institutionId,
      input.resourceId,
      input.bookingId,
      input.reporterId,
      input.type,
      input.severity,
      input.description,
      input.status ?? "OPEN",
      input.resolutionNote ?? null,
      input.resolvedBy ?? null,
      input.status === "RESOLVED" || input.status === "DISMISSED" ? stamp : null,
      stamp,
      stamp,
    );
  const incident = getIncident(input.institutionId, id);
  if (!incident) throw new Error("Incident insert failed");
  return incident;
}

export function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
  resolutionNote: string | null,
  actorId: string,
): void {
  const stamp = nowIso();
  getDb()
    .prepare(
      `UPDATE incidents SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      status,
      resolutionNote,
      status === "RESOLVED" || status === "DISMISSED" ? actorId : null,
      status === "RESOLVED" || status === "DISMISSED" ? stamp : null,
      stamp,
      id,
    );
}

export function openIncidentCount(
  institutionId: string,
  resourceOwnerId?: string,
): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM incidents i JOIN resources r ON r.id = i.resource_id
       WHERE i.institution_id = ? AND i.status IN ('OPEN', 'INVESTIGATING')
       ${resourceOwnerId ? "AND r.owner_id = ?" : ""}`,
    )
    .get(...(resourceOwnerId ? [institutionId, resourceOwnerId] : [institutionId])) as {
    count: number;
  };
  return row.count;
}

export function resolvedIncidentCount(resourceId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS count FROM incidents WHERE resource_id = ? AND status IN ('RESOLVED','DISMISSED')",
    )
    .get(resourceId) as { count: number };
  return row.count;
}
