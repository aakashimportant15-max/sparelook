import { addDays } from "../../lib/time";
import type { Condition, SessionUser } from "../../domain/types";
import { canManageResource } from "../authz";
import { listAuditEvents } from "../audit";
import {
  countCompletedBookings,
  lastReturnCondition,
  listBookings,
  reportsForBooking,
} from "../repos/bookings";
import { busyBlocks } from "../repos/resources";
import {
  incidentsForBooking,
  listIncidents,
  resolvedIncidentCount,
} from "../repos/incidents";
import { visibleResource } from "./resources";

export type PassportEvent = {
  id: string;
  at: string;
  kind: "BOOKING" | "CONDITION" | "INCIDENT" | "RESOURCE" | "AUDIT";
  title: string;
  detail?: string;
  href?: string;
};

export type PassportData = {
  resource: ReturnType<typeof visibleResource>;
  full: boolean;
  summary: {
    completedBookings: number;
    resolvedIncidents: number;
    lastReturnCondition: Condition | null;
    upcomingBusyBlocks: { startAt: string; endAt: string }[];
  };
  bookings: ReturnType<typeof listBookings>;
  reports: ReturnType<typeof reportsForBooking>[];
  incidents: ReturnType<typeof incidentsForBooking>;
  audit: ReturnType<typeof listAuditEvents>;
  timeline: PassportEvent[];
};

const ACTION_TITLES: Record<string, string> = {
  "resource.created": "Resource created",
  "resource.updated": "Resource details updated",
  "resource.status_changed": "Resource status changed",
  "booking.created": "Booking requested",
  "booking.approved": "Booking approved",
  "booking.rejected": "Booking rejected",
  "booking.cancelled": "Booking cancelled",
  "booking.waitlisted": "Request waitlisted",
  "booking.promoted": "Waitlist promoted",
  "booking.expired": "Request expired",
  "booking.checked_out": "Resource checked out",
  "booking.returned": "Resource returned",
  "incident.created": "Incident reported",
  "incident.investigating": "Incident under investigation",
  "incident.resolved": "Incident resolved",
  "incident.dismissed": "Incident dismissed",
  "incident.open": "Incident reopened",
};

export function passportFor(user: SessionUser, resourceId: string): PassportData {
  const resource = visibleResource(user, resourceId);
  const full = canManageResource(user, resource);
  const now = new Date();

  const allBookings = listBookings({
    institutionId: user.institutionId,
    resourceId: resource.id,
    requesterId: full ? undefined : user.id,
    limit: 200,
    order: "start_asc",
  });
  const reports = allBookings.map((booking) => reportsForBooking(booking.id));
  const incidentList = full
    ? listIncidents({
        institutionId: user.institutionId,
        viewerId: user.id,
        viewerRole: "ADMIN",
        resourceId: resource.id,
        limit: 100,
      })
    : allBookings.flatMap((booking) => incidentsForBooking(booking.id));
  const audit = full
    ? listAuditEvents({
        institutionId: user.institutionId,
        resourceId: resource.id,
        limit: 100,
      })
    : [];

  const timeline: PassportEvent[] = [];
  if (full) {
    for (const event of audit) {
      const title = ACTION_TITLES[event.action] ?? event.action;
      timeline.push({
        id: `audit_${event.id}`,
        at: event.createdAt,
        kind:
          event.entityType === "incident"
            ? "INCIDENT"
            : event.entityType === "resource"
              ? "RESOURCE"
              : "BOOKING",
        title,
        detail:
          Object.entries(event.metadata)
            .filter(([key]) =>
              ["status", "toStatus", "from", "to", "condition", "discrepancy"].includes(
                key,
              ),
            )
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(" · ") || undefined,
        href: event.entityType === "booking" ? `/bookings/${event.entityId}` : undefined,
      });
    }
    for (const report of reports.flat()) {
      const missing = Object.entries(report.checklist)
        .filter(([, value]) => value === "MISSING")
        .map(([key]) => key);
      timeline.push({
        id: `report_${report.id}`,
        at: report.createdAt,
        kind: "CONDITION",
        title:
          report.type === "CHECKOUT"
            ? "Checkout condition recorded"
            : "Return condition recorded",
        detail: `${report.overallCondition.replace("_", " ").toLowerCase()}${
          missing.length ? ` · missing: ${missing.join(", ")}` : ""
        }`,
        href: `/bookings/${report.bookingId}`,
      });
    }
  } else {
    for (const booking of allBookings) {
      timeline.push({
        id: `own_${booking.id}`,
        at: booking.createdAt,
        kind: "BOOKING",
        title: `Your booking · ${booking.status.replace("_", " ").toLowerCase()}`,
        detail: booking.purpose,
        href: `/bookings/${booking.id}`,
      });
    }
    for (const incident of incidentList) {
      timeline.push({
        id: `own_inc_${incident.id}`,
        at: incident.createdAt,
        kind: "INCIDENT",
        title: `${incident.type.replace("_", " ").toLowerCase()} incident · ${incident.status.toLowerCase()}`,
        href: `/incidents/${incident.id}`,
      });
    }
  }
  timeline.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  return {
    resource,
    full,
    summary: {
      completedBookings: countCompletedBookings(resource.id),
      resolvedIncidents: resolvedIncidentCount(resource.id),
      lastReturnCondition: lastReturnCondition(resource.id),
      upcomingBusyBlocks: busyBlocks(
        resource.id,
        now.toISOString(),
        addDays(now, 30).toISOString(),
      ),
    },
    bookings: allBookings,
    reports,
    incidents: incidentList,
    audit,
    timeline,
  };
}
