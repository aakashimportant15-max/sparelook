import { errors } from "../lib/errors";
import { writeAudit } from "./audit";
import type { Booking, Incident, Role, SessionUser } from "../domain/types";

export type ResourceOwnership = { id: string; ownerId: string };

export function isAdmin(user: SessionUser): boolean {
  return user.role === "ADMIN";
}

export function isOwnerOf(user: SessionUser, resource: ResourceOwnership): boolean {
  return user.role === "OWNER" && resource.ownerId === user.id;
}

export function canManageResource(
  user: SessionUser,
  resource: ResourceOwnership,
): boolean {
  return isAdmin(user) || isOwnerOf(user, resource);
}

export function canViewBooking(
  user: SessionUser,
  booking: Pick<Booking, "requesterId">,
  resource: ResourceOwnership,
): boolean {
  if (isAdmin(user)) return true;
  if (booking.requesterId === user.id) return true;
  return isOwnerOf(user, resource);
}

export function canApproveBooking(
  user: SessionUser,
  booking: Pick<Booking, "requesterId">,
  resource: ResourceOwnership,
): boolean {
  if (booking.requesterId === user.id) return false;
  return canManageResource(user, resource);
}

export function canViewIncident(
  user: SessionUser,
  incident: Pick<Incident, "reporterId" | "bookingId">,
  resource: ResourceOwnership,
  booking: Pick<Booking, "requesterId"> | null,
): boolean {
  if (isAdmin(user)) return true;
  if (incident.reporterId === user.id) return true;
  if (booking && booking.requesterId === user.id) return true;
  return isOwnerOf(user, resource);
}

export function canViewAudit(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "OWNER";
}

export function canViewFullPassport(
  user: SessionUser,
  resource: ResourceOwnership,
): boolean {
  return canManageResource(user, resource);
}

export function requireRoleOrThrow(
  user: SessionUser,
  roles: Role[],
  message?: string,
): void {
  if (!roles.includes(user.role)) throw errors.forbidden(message);
}

export function deny(
  user: SessionUser,
  action: string,
  entityType: string,
  entityId: string | null,
  requestId: string,
  code: "FORBIDDEN" | "NOT_FOUND" = "FORBIDDEN",
): never {
  writeAudit({
    institutionId: user.institutionId,
    actorId: user.id,
    action: `${action}.denied`,
    entityType,
    entityId,
    outcome: "DENIED",
    metadata: { code },
    requestId,
  });
  if (code === "NOT_FOUND") throw errors.notFound();
  throw errors.forbidden();
}
