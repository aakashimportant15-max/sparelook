import { getDb, nowIso } from "../db/client";
import { newId } from "../lib/ids";
import type { AuditEvent } from "../domain/types";

export type AuditInput = {
  institutionId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  outcome?: "SUCCESS" | "DENIED" | "FAILED";
  metadata?: Record<string, unknown>;
  requestId?: string | null;
};

export function writeAudit(input: AuditInput): void {
  getDb()
    .prepare(
      `INSERT INTO audit_events (id, institution_id, actor_id, action, entity_type, entity_id, outcome, metadata, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId("aud"),
      input.institutionId,
      input.actorId,
      input.action,
      input.entityType,
      input.entityId ?? null,
      input.outcome ?? "SUCCESS",
      JSON.stringify(input.metadata ?? {}),
      input.requestId ?? null,
      nowIso(),
    );
}

type AuditRow = {
  id: string;
  institution_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  outcome: "SUCCESS" | "DENIED" | "FAILED";
  metadata: string;
  request_id: string | null;
  created_at: string;
};

function mapAudit(row: AuditRow): AuditEvent {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(row.metadata);
  } catch {
    metadata = {};
  }
  return {
    id: row.id,
    institutionId: row.institution_id,
    actorId: row.actor_id,
    actorName: row.actor_name ?? undefined,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    outcome: row.outcome,
    metadata,
    requestId: row.request_id,
    createdAt: row.created_at,
  };
}

export function listAuditEvents(options: {
  institutionId: string;
  resourceId?: string | null;
  entityIds?: string[];
  limit?: number;
  offset?: number;
  action?: string;
  outcome?: string;
}): AuditEvent[] {
  const clauses = ["a.institution_id = ?"];
  const params: unknown[] = [options.institutionId];
  if (options.resourceId) {
    clauses.push(
      "(a.entity_id = ? OR a.entity_id IN (SELECT id FROM bookings WHERE resource_id = ?) OR a.entity_id IN (SELECT id FROM incidents WHERE resource_id = ?))",
    );
    params.push(options.resourceId, options.resourceId, options.resourceId);
  }
  if (options.entityIds && options.entityIds.length > 0) {
    clauses.push(`a.entity_id IN (${options.entityIds.map(() => "?").join(",")})`);
    params.push(...options.entityIds);
  }
  if (options.action) {
    clauses.push("a.action LIKE ?");
    params.push(`%${options.action}%`);
  }
  if (options.outcome) {
    clauses.push("a.outcome = ?");
    params.push(options.outcome);
  }
  const rows = getDb()
    .prepare(
      `SELECT a.*, u.display_name AS actor_name
       FROM audit_events a LEFT JOIN users u ON u.id = a.actor_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit ?? 50, options.offset ?? 0) as AuditRow[];
  return rows.map(mapAudit);
}

export function countAuditEvents(institutionId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS count FROM audit_events WHERE institution_id = ?")
    .get(institutionId) as { count: number };
  return row.count;
}
