import { getDb, nowIso } from "../../db/client";
import { newId } from "../../lib/ids";
import type {
  Booking,
  BookingStatus,
  Condition,
  ConditionReport,
  FairShareSnapshot,
} from "../../domain/types";

type BookingRow = {
  id: string;
  institution_id: string;
  resource_id: string;
  resource_name: string;
  resource_owner_id: string;
  requester_id: string;
  requester_name: string;
  start_at: string;
  end_at: string;
  purpose: string;
  status: BookingStatus;
  decision_reason: string | null;
  decided_by: string | null;
  idempotency_key: string;
  late: number;
  discrepancy: number;
  fairness_snapshot: string | null;
  created_at: string;
  updated_at: string;
};

function parseSnapshot(value: string | null): FairShareSnapshot | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as FairShareSnapshot;
  } catch {
    return null;
  }
}

export function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    institutionId: row.institution_id,
    resourceId: row.resource_id,
    resourceName: row.resource_name,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    startAt: row.start_at,
    endAt: row.end_at,
    purpose: row.purpose,
    status: row.status,
    decisionReason: row.decision_reason,
    decidedBy: row.decided_by,
    idempotencyKey: row.idempotency_key,
    late: row.late === 1,
    discrepancy: row.discrepancy === 1,
    fairnessSnapshot: parseSnapshot(row.fairness_snapshot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const BASE_SELECT = `SELECT b.*, r.name AS resource_name, r.owner_id AS resource_owner_id,
    u.display_name AS requester_name
  FROM bookings b
  JOIN resources r ON r.id = b.resource_id
  JOIN users u ON u.id = b.requester_id`;

export function getBooking(institutionId: string, id: string): Booking | null {
  const row = getDb()
    .prepare(`${BASE_SELECT} WHERE b.institution_id = ? AND b.id = ?`)
    .get(institutionId, id) as BookingRow | undefined;
  return row ? mapBooking(row) : null;
}

export function getResourceOwnerId(bookingId: string): string | null {
  const row = getDb()
    .prepare(
      "SELECT r.owner_id FROM bookings b JOIN resources r ON r.id = b.resource_id WHERE b.id = ?",
    )
    .get(bookingId) as { owner_id: string } | undefined;
  return row?.owner_id ?? null;
}

export type BookingListOptions = {
  institutionId: string;
  requesterId?: string;
  resourceOwnerId?: string;
  resourceId?: string;
  statuses?: BookingStatus[];
  limit?: number;
  offset?: number;
  order?: "start_asc" | "created_desc";
};

export function listBookings(options: BookingListOptions): Booking[] {
  const clauses = ["b.institution_id = ?"];
  const params: unknown[] = [options.institutionId];
  if (options.requesterId) {
    clauses.push("b.requester_id = ?");
    params.push(options.requesterId);
  }
  if (options.resourceOwnerId) {
    clauses.push("r.owner_id = ?");
    params.push(options.resourceOwnerId);
  }
  if (options.resourceId) {
    clauses.push("b.resource_id = ?");
    params.push(options.resourceId);
  }
  if (options.statuses && options.statuses.length > 0) {
    clauses.push(`b.status IN (${options.statuses.map(() => "?").join(",")})`);
    params.push(...options.statuses);
  }
  const order =
    options.order === "created_desc"
      ? "b.created_at DESC"
      : "b.start_at ASC, b.created_at ASC";
  const rows = getDb()
    .prepare(
      `${BASE_SELECT} WHERE ${clauses.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit ?? 50, options.offset ?? 0) as BookingRow[];
  return rows.map(mapBooking);
}

export function findBlockingOverlap(
  resourceId: string,
  startAt: string,
  endAt: string,
  excludeId?: string,
): { id: string; startAt: string; endAt: string } | null {
  const row = getDb()
    .prepare(
      `SELECT id, start_at AS startAt, end_at AS endAt FROM bookings
       WHERE resource_id = ? AND status IN ('APPROVED', 'CHECKED_OUT')
         AND start_at < ? AND end_at > ? AND id <> ?
       ORDER BY start_at LIMIT 1`,
    )
    .get(resourceId, endAt, startAt, excludeId ?? "") as
    { id: string; startAt: string; endAt: string } | undefined;
  return row ?? null;
}

export function findOverlappingPending(
  resourceId: string,
  startAt: string,
  endAt: string,
  excludeId?: string,
): Booking[] {
  const rows = getDb()
    .prepare(
      `${BASE_SELECT} WHERE b.resource_id = ? AND b.status = 'PENDING'
        AND b.start_at < ? AND b.end_at > ? AND b.id <> ?
       ORDER BY b.created_at ASC, b.id ASC`,
    )
    .all(resourceId, endAt, startAt, excludeId ?? "") as BookingRow[];
  return rows.map(mapBooking);
}

export function findWaitlistCandidates(
  resourceId: string,
  startAt: string,
  endAt: string,
): Booking[] {
  const rows = getDb()
    .prepare(
      `${BASE_SELECT} WHERE b.resource_id = ? AND b.status = 'WAITLISTED'
        AND b.start_at < ? AND b.end_at > ?
       ORDER BY b.created_at ASC, b.id ASC`,
    )
    .all(resourceId, endAt, startAt) as BookingRow[];
  return rows.map(mapBooking);
}

export function openBookingCount(userId: string, excludeId?: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE requester_id = ? AND status IN ('PENDING', 'APPROVED', 'CHECKED_OUT') AND id <> ?`,
    )
    .get(userId, excludeId ?? "") as { count: number };
  return row.count;
}

export function waitlistCount(userId: string, excludeId?: string): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS count FROM bookings WHERE requester_id = ? AND status = 'WAITLISTED' AND id <> ?",
    )
    .get(userId, excludeId ?? "") as { count: number };
  return row.count;
}

export function sumHours(
  userId: string,
  statuses: readonly string[],
  fromIso: string,
  toIso: string,
  excludeId?: string,
): number {
  const rows = getDb()
    .prepare(
      `SELECT start_at, end_at FROM bookings
       WHERE requester_id = ? AND status IN (${statuses.map(() => "?").join(",")})
         AND start_at >= ? AND start_at < ? AND id <> ?`,
    )
    .all(userId, ...statuses, fromIso, toIso, excludeId ?? "") as {
    start_at: string;
    end_at: string;
  }[];
  return rows.reduce(
    (total, row) =>
      total +
      (new Date(row.end_at).getTime() - new Date(row.start_at).getTime()) / 3_600_000,
    0,
  );
}

export function usageHours30d(
  userId: string,
  sinceIso: string,
  nowIsoValue: string,
): number {
  return sumHours(userId, ["CHECKED_OUT", "RETURNED"], sinceIso, nowIsoValue);
}

export type NewBooking = {
  institutionId: string;
  resourceId: string;
  requesterId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  status: BookingStatus;
  idempotencyKey: string;
  fairnessSnapshot?: FairShareSnapshot | null;
};

export function insertBooking(input: NewBooking): Booking {
  const db = getDb();
  const id = newId("bkg");
  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO bookings (id, institution_id, resource_id, requester_id, start_at, end_at, purpose, status,
      idempotency_key, fairness_snapshot, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.institutionId,
    input.resourceId,
    input.requesterId,
    input.startAt,
    input.endAt,
    input.purpose,
    input.status,
    input.idempotencyKey,
    input.fairnessSnapshot ? JSON.stringify(input.fairnessSnapshot) : null,
    timestamp,
    timestamp,
  );
  const created = getBooking(input.institutionId, id);
  if (!created) throw new Error("Booking insert failed");
  return created;
}

export function findByIdempotencyKey(requesterId: string, key: string): Booking | null {
  const row = getDb()
    .prepare(`${BASE_SELECT} WHERE b.requester_id = ? AND b.idempotency_key = ?`)
    .get(requesterId, key) as BookingRow | undefined;
  return row ? mapBooking(row) : null;
}

export function updateBooking(
  id: string,
  changes: {
    status?: BookingStatus;
    decisionReason?: string | null;
    decidedBy?: string | null;
    fairnessSnapshot?: FairShareSnapshot | null;
    late?: boolean;
    discrepancy?: boolean;
  },
): void {
  const current = getDb().prepare("SELECT * FROM bookings WHERE id = ?").get(id) as
    { status: string } | undefined;
  if (!current) throw new Error("Booking not found");
  const sets: string[] = [];
  const params: unknown[] = [];
  if (changes.status) {
    sets.push("status = ?");
    params.push(changes.status);
  }
  if (changes.decisionReason !== undefined) {
    sets.push("decision_reason = ?");
    params.push(changes.decisionReason);
  }
  if (changes.decidedBy !== undefined) {
    sets.push("decided_by = ?");
    params.push(changes.decidedBy);
  }
  if (changes.fairnessSnapshot !== undefined) {
    sets.push("fairness_snapshot = ?");
    params.push(
      changes.fairnessSnapshot ? JSON.stringify(changes.fairnessSnapshot) : null,
    );
  }
  if (changes.late !== undefined) {
    sets.push("late = ?");
    params.push(changes.late ? 1 : 0);
  }
  if (changes.discrepancy !== undefined) {
    sets.push("discrepancy = ?");
    params.push(changes.discrepancy ? 1 : 0);
  }
  sets.push("updated_at = ?");
  params.push(nowIso());
  params.push(id);
  getDb()
    .prepare(`UPDATE bookings SET ${sets.join(", ")} WHERE id = ?`)
    .run(...params);
}

export function addHistory(input: {
  bookingId: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  actorId: string | null;
  reasonCode?: string | null;
  reasonText?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, reason_code, reason_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      newId("hist"),
      input.bookingId,
      input.fromStatus,
      input.toStatus,
      input.actorId,
      input.reasonCode ?? null,
      input.reasonText ?? null,
      nowIso(),
    );
}

export function bookingHistory(bookingId: string) {
  return getDb()
    .prepare(
      `SELECT h.id, h.from_status AS fromStatus, h.to_status AS toStatus, h.actor_id AS actorId,
              u.display_name AS actorName, h.reason_code AS reasonCode, h.reason_text AS reasonText,
              h.created_at AS createdAt
       FROM booking_status_history h LEFT JOIN users u ON u.id = h.actor_id
       WHERE h.booking_id = ? ORDER BY h.created_at ASC, h.id ASC`,
    )
    .all(bookingId) as {
    id: string;
    fromStatus: BookingStatus | null;
    toStatus: BookingStatus;
    actorId: string | null;
    actorName: string | null;
    reasonCode: string | null;
    reasonText: string | null;
    createdAt: string;
  }[];
}

export function staleBookings(nowIsoValue: string): Booking[] {
  const rows = getDb()
    .prepare(
      `SELECT b.*, r.name AS resource_name, r.owner_id AS resource_owner_id, u.display_name AS requester_name
       FROM bookings b JOIN resources r ON r.id = b.resource_id JOIN users u ON u.id = b.requester_id
       WHERE b.status IN ('PENDING', 'WAITLISTED') AND b.start_at <= ?`,
    )
    .all(nowIsoValue) as BookingRow[];
  return rows.map(mapBooking);
}

export function futureApprovedForResource(
  resourceId: string,
  nowIsoValue: string,
): Booking[] {
  const rows = getDb()
    .prepare(
      `${BASE_SELECT} WHERE b.resource_id = ? AND b.status IN ('APPROVED', 'CHECKED_OUT') AND b.end_at > ? ORDER BY b.start_at`,
    )
    .all(resourceId, nowIsoValue) as BookingRow[];
  return rows.map(mapBooking);
}

/* ---------- condition reports ---------- */

type ReportRow = {
  id: string;
  booking_id: string;
  type: "CHECKOUT" | "RETURN";
  overall_condition: Condition;
  checklist: string;
  notes: string;
  recorded_by: string;
  recorded_by_name: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  disputed: number;
  created_at: string;
};

function mapReport(row: ReportRow): ConditionReport {
  let checklist: Record<string, "PRESENT" | "MISSING"> = {};
  try {
    checklist = JSON.parse(row.checklist);
  } catch {
    checklist = {};
  }
  return {
    id: row.id,
    bookingId: row.booking_id,
    type: row.type,
    overallCondition: row.overall_condition,
    checklist,
    notes: row.notes,
    recordedBy: row.recorded_by,
    recordedByName: row.recorded_by_name,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    disputed: row.disputed === 1,
    createdAt: row.created_at,
  };
}

export function reportsForBooking(bookingId: string): ConditionReport[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*, u.display_name AS recorded_by_name FROM condition_reports c
       JOIN users u ON u.id = c.recorded_by WHERE c.booking_id = ? ORDER BY c.created_at`,
    )
    .all(bookingId) as ReportRow[];
  return rows.map(mapReport);
}

export function getReport(
  bookingId: string,
  type: "CHECKOUT" | "RETURN",
): ConditionReport | null {
  const row = getDb()
    .prepare(
      `SELECT c.*, u.display_name AS recorded_by_name FROM condition_reports c
       JOIN users u ON u.id = c.recorded_by WHERE c.booking_id = ? AND c.type = ?`,
    )
    .get(bookingId, type) as ReportRow | undefined;
  return row ? mapReport(row) : null;
}

export function insertReport(input: {
  institutionId: string;
  bookingId: string;
  type: "CHECKOUT" | "RETURN";
  condition: Condition;
  checklist: Record<string, "PRESENT" | "MISSING">;
  notes: string;
  recordedBy: string;
}): ConditionReport {
  const db = getDb();
  const id = newId("rep");
  const stamp = nowIso();
  db.prepare(
    `INSERT INTO condition_reports (id, institution_id, booking_id, type, overall_condition, checklist, notes,
      recorded_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.institutionId,
    input.bookingId,
    input.type,
    input.condition,
    JSON.stringify(input.checklist),
    input.notes,
    input.recordedBy,
    stamp,
    stamp,
  );
  const report = getReport(input.bookingId, input.type);
  if (!report) throw new Error("Condition report insert failed");
  return report;
}

export function countCompletedBookings(resourceId: string): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS count FROM bookings WHERE resource_id = ? AND status = 'RETURNED'",
    )
    .get(resourceId) as { count: number };
  return row.count;
}

export function lastReturnCondition(resourceId: string): Condition | null {
  const row = getDb()
    .prepare(
      `SELECT c.overall_condition FROM condition_reports c
       JOIN bookings b ON b.id = c.booking_id
       WHERE b.resource_id = ? AND c.type = 'RETURN'
       ORDER BY c.created_at DESC LIMIT 1`,
    )
    .get(resourceId) as { overall_condition: Condition } | undefined;
  return row?.overall_condition ?? null;
}
