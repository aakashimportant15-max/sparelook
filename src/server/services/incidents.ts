import { errors, AppError } from "../../lib/errors";
import { POLICY } from "../../domain/policy";
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentType,
  SessionUser,
} from "../../domain/types";
import { canManageResource, deny, isAdmin } from "../authz";
import { listAuditEvents, writeAudit } from "../audit";
import {
  getIncident,
  getIncidentResourceOwner,
  insertIncident,
  listIncidents,
  updateIncidentStatus,
} from "../repos/incidents";
import { getBooking } from "../repos/bookings";
import { getResourceById } from "../repos/resources";

export type CreateIncidentInput = {
  resourceId: string;
  bookingId?: string | null;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
};

export function createIncidentForUser(
  user: SessionUser,
  input: CreateIncidentInput,
  requestId: string,
): Incident {
  const resource = getResourceById(user.institutionId, input.resourceId);
  if (!resource) throw errors.notFound();
  const description = input.description.trim();
  if (
    description.length < POLICY.incidentDescriptionMin ||
    description.length > POLICY.incidentDescriptionMax
  ) {
    throw errors.validation([
      {
        field: "description",
        code: "INVALID_LENGTH",
        message: `Describe the issue in ${POLICY.incidentDescriptionMin}–${POLICY.incidentDescriptionMax} characters.`,
      },
    ]);
  }

  const bookingId: string | null = input.bookingId ?? null;
  if (bookingId) {
    const booking = getBooking(user.institutionId, bookingId);
    if (!booking || booking.resourceId !== resource.id) throw errors.notFound();
    const involved = booking.requesterId === user.id || canManageResource(user, resource);
    if (!involved)
      deny(user, "incident.create", "incident", null, requestId, "NOT_FOUND");
  } else if (!canManageResource(user, resource)) {
    deny(user, "incident.create", "incident", null, requestId, "NOT_FOUND");
  }

  const incident = insertIncident({
    institutionId: user.institutionId,
    resourceId: resource.id,
    bookingId,
    reporterId: user.id,
    type: input.type,
    severity: input.severity,
    description,
  });
  writeAudit({
    institutionId: user.institutionId,
    actorId: user.id,
    action: "incident.created",
    entityType: "incident",
    entityId: incident.id,
    metadata: { type: input.type, severity: input.severity },
    requestId,
  });
  return incident;
}

const ALLOWED_INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ["INVESTIGATING"],
  INVESTIGATING: ["RESOLVED", "DISMISSED"],
  RESOLVED: ["OPEN"],
  DISMISSED: ["OPEN"],
};

export function updateIncidentForUser(
  user: SessionUser,
  incidentId: string,
  nextStatus: IncidentStatus,
  resolutionNoteRaw: string | undefined,
  requestId: string,
): Incident {
  const incident = getIncident(user.institutionId, incidentId);
  if (!incident) throw errors.notFound();
  const resource = getResourceById(user.institutionId, incident.resourceId);
  if (!resource) throw errors.notFound();
  if (!canManageResource(user, resource)) {
    deny(user, "incident.update", "incident", incidentId, requestId, "NOT_FOUND");
  }
  if (incident.status === nextStatus) {
    throw new AppError(
      "INVALID_TRANSITION",
      "The incident is already in that state.",
      409,
    );
  }
  if (nextStatus === "OPEN" && !isAdmin(user)) {
    deny(user, "incident.reopen", "incident", incidentId, requestId);
  }
  if (!ALLOWED_INCIDENT_TRANSITIONS[incident.status].includes(nextStatus)) {
    throw new AppError(
      "INVALID_TRANSITION",
      `An incident cannot move from ${incident.status} to ${nextStatus}.`,
      409,
    );
  }
  const needsNote = nextStatus === "RESOLVED" || nextStatus === "DISMISSED";
  const note = (resolutionNoteRaw ?? "").trim();
  if (needsNote && note.length < 5) {
    throw errors.validation([
      {
        field: "resolutionNote",
        code: "REASON_REQUIRED",
        message: "Add a short resolution note (at least 5 characters).",
      },
    ]);
  }
  if (note.length > POLICY.notesMax) {
    throw errors.validation([
      {
        field: "resolutionNote",
        code: "TOO_LONG",
        message: `Resolution note must be ${POLICY.notesMax} characters or fewer.`,
      },
    ]);
  }
  updateIncidentStatus(incidentId, nextStatus, needsNote ? note : null, user.id);
  writeAudit({
    institutionId: user.institutionId,
    actorId: user.id,
    action: `incident.${nextStatus.toLowerCase()}`,
    entityType: "incident",
    entityId: incidentId,
    metadata: { from: incident.status, to: nextStatus },
    requestId,
  });
  const updated = getIncident(user.institutionId, incidentId);
  if (!updated) throw errors.notFound();
  return updated;
}

export type IncidentHistoryEntry = {
  id: string;
  action: string;
  actorName: string | null;
  createdAt: string;
  from: string | null;
  to: string | null;
};

/**
 * Status history is read from the append-only audit trail so it always reflects
 * the real transitions and actors; it is only exposed to resource managers.
 */
function incidentStatusHistory(
  incidentId: string,
  institutionId: string,
): IncidentHistoryEntry[] {
  return listAuditEvents({
    institutionId,
    entityIds: [incidentId],
    action: "incident",
    limit: 100,
  })
    .filter((event) => event.outcome === "SUCCESS")
    .reverse()
    .map((event) => ({
      id: event.id,
      action: event.action,
      actorName: event.actorName ?? null,
      createdAt: event.createdAt,
      from: typeof event.metadata.from === "string" ? event.metadata.from : null,
      to: typeof event.metadata.to === "string" ? event.metadata.to : null,
    }));
}

export function incidentDetail(user: SessionUser, incidentId: string) {
  const incident = getIncident(user.institutionId, incidentId);
  if (!incident) throw errors.notFound();
  const resource = getResourceById(user.institutionId, incident.resourceId);
  if (!resource) throw errors.notFound();
  const booking = incident.bookingId
    ? getBooking(user.institutionId, incident.bookingId)
    : null;
  const involved =
    isAdmin(user) ||
    incident.reporterId === user.id ||
    booking?.requesterId === user.id ||
    (user.role === "OWNER" && resource.ownerId === user.id);
  if (!involved) throw errors.notFound();
  const canManage = canManageResource(user, resource);
  return {
    incident,
    resource,
    booking,
    canManage,
    canReopen: isAdmin(user),
    history: canManage ? incidentStatusHistory(incident.id, user.institutionId) : [],
  };
}

export function incidentListForUser(
  user: SessionUser,
  filters: { status?: IncidentStatus; severity?: IncidentSeverity },
) {
  return listIncidents({
    institutionId: user.institutionId,
    viewerId: user.id,
    viewerRole: user.role,
    status: filters.status,
    severity: filters.severity,
    limit: 100,
  });
}

export function incidentOwnerId(incidentId: string): string | null {
  return getIncidentResourceOwner(incidentId);
}
