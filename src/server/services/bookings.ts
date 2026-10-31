import { errors, AppError } from "../../lib/errors";
import { POLICY } from "../../domain/policy";
import { assertTransition } from "../../domain/booking-machine";
import {
  buildSnapshot,
  explainWaitlistPosition,
  overrideRequired,
  rankCandidates,
  type RankedCandidate,
} from "../../domain/fairshare";
import { validateBookingRequest } from "../../domain/validation";
import { addMinutes, durationHours, formatRange, localWeekRange } from "../../lib/time";
import type {
  Booking,
  BookingStatus,
  Condition,
  Incident,
  Resource,
  SessionUser,
} from "../../domain/types";
import { transactionImmediate } from "../../db/client";
import { getUserById } from "../auth";
import { canApproveBooking, canManageResource, deny } from "../authz";
import { writeAudit } from "../audit";
import {
  addHistory,
  bookingHistory,
  findBlockingOverlap,
  findByIdempotencyKey,
  findOverlappingPending,
  findWaitlistCandidates,
  getBooking,
  insertBooking,
  insertReport,
  listBookings,
  reportsForBooking,
  staleBookings,
  sumHours,
  updateBooking,
  usageHours30d,
} from "../repos/bookings";
import { getResourceById } from "../repos/resources";
import { insertIncident, incidentsForBooking, listIncidents } from "../repos/incidents";
import { evaluateEligibility } from "./eligibility";

function bookingContext(
  user: SessionUser,
  bookingId: string,
): { booking: Booking; resource: Resource } {
  const booking = getBooking(user.institutionId, bookingId);
  if (!booking) throw errors.notFound();
  const resource = getResourceById(user.institutionId, booking.resourceId);
  if (!resource) throw errors.notFound();
  return { booking, resource };
}

function mapConflict(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("BOOKING_CONFLICT")) {
    throw errors.bookingConflict("That time slot is already booked.");
  }
  throw error;
}

function validReason(
  reason: string | undefined,
  min: number,
  max: number,
): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}

export type CreateBookingInput = {
  resourceId: string;
  startAt: string;
  endAt: string;
  purpose: string;
  joinWaitlist?: boolean;
};

export type CreateBookingResult = { booking: Booking; replay: boolean };

export function createBooking(
  user: SessionUser,
  input: CreateBookingInput,
  idempotencyKey: string,
  requestId: string,
  now = new Date(),
): CreateBookingResult {
  const existing = findByIdempotencyKey(user.id, idempotencyKey);
  if (existing) return { booking: existing, replay: true };

  const resource = getResourceById(user.institutionId, input.resourceId);
  if (!resource) throw errors.notFound("We could not find that resource.");
  if (resource.status !== "ACTIVE") {
    throw errors.resourceUnavailable(
      resource.status === "MAINTENANCE"
        ? "This resource is under maintenance and cannot be requested."
        : "This resource is not available for booking.",
    );
  }

  const validation = validateBookingRequest({
    startRaw: input.startAt,
    endRaw: input.endAt,
    purpose: input.purpose,
    maxDurationHours: resource.maxDurationHours,
    openTime: resource.openTime,
    closeTime: resource.closeTime,
    timeZone: user.timezone,
    now,
  });
  if (validation.errors.length > 0 || !validation.start || !validation.end) {
    throw errors.validation(validation.errors);
  }
  const start = validation.start;
  const end = validation.end;
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const requestedHours = durationHours(start, end);

  const preConflict = findBlockingOverlap(resource.id, startIso, endIso);
  const requestingWaitlist = Boolean(input.joinWaitlist && preConflict);
  const eligibility = evaluateEligibility(user, resource, {
    requestedHours,
    requestingWaitlist,
    now,
  });
  if (!eligibility.eligible) throw errors.notEligible(eligibility.reasons);

  try {
    return transactionImmediate(() => {
      const replay = findByIdempotencyKey(user.id, idempotencyKey);
      if (replay) return { booking: replay, replay: true };

      const conflict = findBlockingOverlap(resource.id, startIso, endIso);
      let status: BookingStatus;
      if (conflict) {
        if (!input.joinWaitlist) {
          throw errors.bookingConflict("That time slot is already booked.", {
            conflict: { startAt: conflict.startAt, endAt: conflict.endAt },
          });
        }
        status = "WAITLISTED";
      } else {
        status = resource.approvalRequired ? "PENDING" : "APPROVED";
      }

      const booking = insertBooking({
        institutionId: user.institutionId,
        resourceId: resource.id,
        requesterId: user.id,
        startAt: startIso,
        endAt: endIso,
        purpose: input.purpose.trim(),
        status,
        idempotencyKey,
      });
      addHistory({
        bookingId: booking.id,
        fromStatus: null,
        toStatus: status,
        actorId: user.id,
        reasonCode: status === "WAITLISTED" ? "JOINED_WAITLIST" : null,
      });
      writeAudit({
        institutionId: user.institutionId,
        actorId: user.id,
        action: "booking.created",
        entityType: "booking",
        entityId: booking.id,
        metadata: { status, resourceId: resource.id },
        requestId,
      });
      if (status === "APPROVED") {
        addHistory({
          bookingId: booking.id,
          fromStatus: "PENDING",
          toStatus: "APPROVED",
          actorId: null,
          reasonCode: "AUTO_APPROVED",
        });
        writeAudit({
          institutionId: user.institutionId,
          actorId: null,
          action: "booking.approved",
          entityType: "booking",
          entityId: booking.id,
          metadata: { status: "APPROVED", auto: true },
          requestId,
        });
      }
      return { booking, replay: false };
    });
  } catch (error) {
    mapConflict(error);
  }
}

function competingRanking(
  resourceId: string,
  startIso: string,
  endIso: string,
  now: Date,
): RankedCandidate[] {
  const pending = findOverlappingPending(resourceId, startIso, endIso);
  const since = new Date(
    now.getTime() - POLICY.usageWindowDays * 86_400_000,
  ).toISOString();
  const candidates = pending.map((booking) => ({
    bookingId: booking.id,
    requesterId: booking.requesterId,
    createdAt: booking.createdAt,
    usageHours30d: usageHours30d(booking.requesterId, since, now.toISOString()),
  }));
  return rankCandidates(candidates);
}

function waitlistRanking(
  resourceId: string,
  startIso: string,
  endIso: string,
  now: Date,
): RankedCandidate[] {
  const waitlisted = findWaitlistCandidates(resourceId, startIso, endIso);
  const since = new Date(
    now.getTime() - POLICY.usageWindowDays * 86_400_000,
  ).toISOString();
  return rankCandidates(
    waitlisted.map((booking) => ({
      bookingId: booking.id,
      requesterId: booking.requesterId,
      createdAt: booking.createdAt,
      usageHours30d: usageHours30d(booking.requesterId, since, now.toISOString()),
    })),
  );
}

export type WaitlistView = {
  position: number;
  total: number;
  usageHours30d: number;
  explanation: string;
};

export function waitlistView(booking: Booking, now = new Date()): WaitlistView | null {
  if (booking.status !== "WAITLISTED") return null;
  const ranked = waitlistRanking(booking.resourceId, booking.startAt, booking.endAt, now);
  const mine = ranked.find((candidate) => candidate.bookingId === booking.id);
  if (!mine) return null;
  return {
    position: mine.rank,
    total: ranked.length,
    usageHours30d: mine.usageHours30d,
    explanation: explainWaitlistPosition(mine.rank, ranked.length),
  };
}

export function waitlistViewForBooking(
  user: SessionUser,
  booking: Booking,
  now = new Date(),
): WaitlistView | null {
  if (booking.institutionId !== user.institutionId) return null;
  return waitlistView(booking, now);
}

export function approveBooking(
  user: SessionUser,
  bookingId: string,
  overrideReasonRaw: string | undefined,
  requestId: string,
  now = new Date(),
): { booking: Booking; snapshot: ReturnType<typeof buildSnapshot> } {
  const { booking, resource } = bookingContext(user, bookingId);
  if (!canApproveBooking(user, booking, resource)) {
    deny(user, "booking.approve", "booking", bookingId, requestId);
  }
  if (booking.status !== "PENDING") assertTransition(booking.status, "APPROVED");

  try {
    return transactionImmediate(() => {
      const fresh = getBooking(user.institutionId, bookingId);
      if (!fresh) throw errors.notFound();
      if (fresh.status !== "PENDING") assertTransition(fresh.status, "APPROVED");

      const requesterNow = getUserById(fresh.requesterId);
      if (!requesterNow) throw errors.notFound();
      const hours = durationHours(new Date(fresh.startAt), new Date(fresh.endAt));
      const eligibility = evaluateEligibility(requesterNow, resource, {
        requestedHours: hours,
        excludeBookingId: fresh.id,
        now,
      });
      if (!eligibility.eligible) throw errors.notEligible(eligibility.reasons);

      const conflict = findBlockingOverlap(
        resource.id,
        fresh.startAt,
        fresh.endAt,
        fresh.id,
      );
      if (conflict) {
        throw errors.bookingConflict("That time slot is no longer free.", {
          conflict: { startAt: conflict.startAt, endAt: conflict.endAt },
        });
      }

      const ranked = competingRanking(resource.id, fresh.startAt, fresh.endAt, now);
      const chosen = ranked.find((candidate) => candidate.bookingId === fresh.id);
      if (!chosen) throw new Error("Chosen booking missing from ranking");
      const snapshot = buildSnapshot(chosen, ranked.length);

      let overrideReason: string | null = null;
      if (overrideRequired(chosen.rank)) {
        overrideReason = validReason(
          overrideReasonRaw,
          POLICY.overrideReasonMin,
          POLICY.overrideReasonMax,
        );
        if (!overrideReason) throw errors.overrideRequired();
      }

      for (const candidate of ranked) {
        updateBooking(candidate.bookingId, {
          fairnessSnapshot: buildSnapshot(candidate, ranked.length),
        });
      }

      updateBooking(fresh.id, {
        status: "APPROVED",
        decidedBy: user.id,
        decisionReason: overrideReason,
      });
      addHistory({
        bookingId: fresh.id,
        fromStatus: "PENDING",
        toStatus: "APPROVED",
        actorId: user.id,
        reasonCode: overrideReason ? "FAIRSHARE_OVERRIDE" : null,
        reasonText: overrideReason,
      });
      writeAudit({
        institutionId: user.institutionId,
        actorId: user.id,
        action: "booking.approved",
        entityType: "booking",
        entityId: fresh.id,
        metadata: {
          rank: chosen.rank,
          competingCount: ranked.length,
          override: Boolean(overrideReason),
        },
        requestId,
      });

      const superseded = ranked.filter((candidate) => candidate.bookingId !== fresh.id);
      for (const other of superseded) {
        updateBooking(other.bookingId, {
          status: "WAITLISTED",
          decisionReason:
            "Another request for this slot was approved first, so this request joined the waitlist. If that booking is cancelled, the fairest eligible request is promoted automatically.",
        });
        addHistory({
          bookingId: other.bookingId,
          fromStatus: "PENDING",
          toStatus: "WAITLISTED",
          actorId: null,
          reasonCode: "SUPERSEDED_BY_APPROVED_BOOKING",
          reasonText: "Another request for this slot was approved.",
        });
        writeAudit({
          institutionId: user.institutionId,
          actorId: user.id,
          action: "booking.waitlisted",
          entityType: "booking",
          entityId: other.bookingId,
          metadata: { reason: "SUPERSEDED_BY_APPROVED_BOOKING" },
          requestId,
        });
      }

      const updated = getBooking(user.institutionId, fresh.id);
      if (!updated) throw errors.notFound();
      return { booking: updated, snapshot };
    });
  } catch (error) {
    mapConflict(error);
  }
}

export function rejectBooking(
  user: SessionUser,
  bookingId: string,
  reasonRaw: string | undefined,
  requestId: string,
): Booking {
  const { booking, resource } = bookingContext(user, bookingId);
  if (!canApproveBooking(user, booking, resource)) {
    deny(user, "booking.reject", "booking", bookingId, requestId);
  }
  const reason = validReason(reasonRaw, POLICY.reasonMin, POLICY.reasonMax);
  if (!reason) {
    throw errors.validation([
      {
        field: "reason",
        code: "REASON_REQUIRED",
        message: `Give a reason between ${POLICY.reasonMin} and ${POLICY.reasonMax} characters.`,
      },
    ]);
  }
  if (booking.status !== "PENDING") assertTransition(booking.status, "REJECTED");
  transactionImmediate(() => {
    updateBooking(bookingId, {
      status: "REJECTED",
      decisionReason: reason,
      decidedBy: user.id,
    });
    addHistory({
      bookingId,
      fromStatus: "PENDING",
      toStatus: "REJECTED",
      actorId: user.id,
      reasonText: reason,
    });
    writeAudit({
      institutionId: user.institutionId,
      actorId: user.id,
      action: "booking.rejected",
      entityType: "booking",
      entityId: bookingId,
      metadata: {},
      requestId,
    });
  });
  const updated = getBooking(user.institutionId, bookingId);
  if (!updated) throw errors.notFound();
  return updated;
}

export function cancelBooking(
  user: SessionUser,
  bookingId: string,
  reasonRaw: string | undefined,
  requestId: string,
  now = new Date(),
): Booking {
  const { booking, resource } = bookingContext(user, bookingId);
  const isRequester = booking.requesterId === user.id;
  const isManager = canManageResource(user, resource);
  if (!isRequester && !isManager) {
    deny(user, "booking.cancel", "booking", bookingId, requestId, "NOT_FOUND");
  }
  if (!["PENDING", "WAITLISTED", "APPROVED"].includes(booking.status)) {
    assertTransition(booking.status, "CANCELLED");
  }
  if (
    isRequester &&
    booking.status === "APPROVED" &&
    now.getTime() >= new Date(booking.startAt).getTime()
  ) {
    throw new AppError(
      "INVALID_TRANSITION",
      "This booking has already started. Ask the resource owner to cancel it.",
      409,
    );
  }

  let reason: string | null = null;
  let reasonCode: string | null = null;
  if (!isRequester) {
    reason = validReason(reasonRaw, POLICY.reasonMin, POLICY.reasonMax);
    if (!reason) {
      throw errors.validation([
        {
          field: "reason",
          code: "REASON_REQUIRED",
          message: `Give a reason between ${POLICY.reasonMin} and ${POLICY.reasonMax} characters.`,
        },
      ]);
    }
    const minutesPastStart =
      (now.getTime() - new Date(booking.startAt).getTime()) / 60_000;
    if (minutesPastStart >= POLICY.noShowAfterMinutes) reasonCode = "NO_SHOW";
  }

  transactionImmediate(() => {
    updateBooking(bookingId, {
      status: "CANCELLED",
      decisionReason: reason,
      decidedBy: user.id,
    });
    addHistory({
      bookingId,
      fromStatus: booking.status,
      toStatus: "CANCELLED",
      actorId: user.id,
      reasonCode,
      reasonText: reason,
    });
    writeAudit({
      institutionId: user.institutionId,
      actorId: user.id,
      action: "booking.cancelled",
      entityType: "booking",
      entityId: bookingId,
      metadata: { fromStatus: booking.status, reasonCode },
      requestId,
    });
    if (booking.status === "APPROVED") {
      promoteWaitlistLocked(
        resource,
        booking.startAt,
        booking.endAt,
        user.id,
        requestId,
        now,
      );
    }
  });
  const updated = getBooking(user.institutionId, bookingId);
  if (!updated) throw errors.notFound();
  return updated;
}

function promoteWaitlistLocked(
  resource: Resource,
  startAt: string,
  endAt: string,
  actorId: string | null,
  requestId: string,
  now: Date,
): Booking | null {
  const candidates = findWaitlistCandidates(resource.id, startAt, endAt);
  if (candidates.length === 0) return null;
  const since = new Date(
    now.getTime() - POLICY.usageWindowDays * 86_400_000,
  ).toISOString();
  const viable: {
    booking: Booking;
    usage: number;
  }[] = [];
  for (const candidate of candidates) {
    const requester = getUserById(candidate.requesterId);
    if (!requester || requester.status !== "ACTIVE") continue;
    const hours = durationHours(new Date(candidate.startAt), new Date(candidate.endAt));
    const eligibility = evaluateEligibility(requester, resource, {
      requestedHours: hours,
      excludeBookingId: candidate.id,
      now,
    });
    if (!eligibility.eligible) continue;
    viable.push({
      booking: candidate,
      usage: usageHours30d(candidate.requesterId, since, now.toISOString()),
    });
  }
  if (viable.length === 0) return null;
  viable.sort((a, b) => {
    if (a.usage !== b.usage) return a.usage - b.usage;
    if (a.booking.createdAt !== b.booking.createdAt)
      return a.booking.createdAt < b.booking.createdAt ? -1 : 1;
    return a.booking.id < b.booking.id ? -1 : 1;
  });
  const winner = viable[0].booking;
  const nextStatus: BookingStatus = resource.approvalRequired ? "PENDING" : "APPROVED";
  updateBooking(winner.id, {
    status: nextStatus,
    fairnessSnapshot: {
      rank: 1,
      competingCount: candidates.length,
      usageHours30d: Number(viable[0].usage.toFixed(2)),
      createdAt: winner.createdAt,
      rule: "R2",
      version: POLICY.fairShareVersion,
    },
  });
  addHistory({
    bookingId: winner.id,
    fromStatus: "WAITLISTED",
    toStatus: nextStatus,
    actorId: null,
    reasonCode: "PROMOTED_FROM_WAITLIST",
    reasonText: "A conflicting booking was cancelled.",
  });
  writeAudit({
    institutionId: resource.institutionId,
    actorId,
    action: "booking.promoted",
    entityType: "booking",
    entityId: winner.id,
    metadata: { toStatus: nextStatus },
    requestId,
  });
  return getBooking(resource.institutionId, winner.id);
}

export function expireStaleBookings(now = new Date()): number {
  const stamp = now.toISOString();
  const stale = staleBookings(stamp);
  if (stale.length === 0) return 0;
  transactionImmediate(() => {
    for (const booking of stale) {
      updateBooking(booking.id, { status: "EXPIRED" });
      addHistory({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: "EXPIRED",
        actorId: null,
        reasonCode: "START_TIME_PASSED",
      });
      writeAudit({
        institutionId: booking.institutionId,
        actorId: null,
        action: "booking.expired",
        entityType: "booking",
        entityId: booking.id,
        metadata: { fromStatus: booking.status },
        requestId: null,
      });
    }
  });
  return stale.length;
}

export type ConditionInput = {
  overallCondition: Condition;
  checklist: Record<string, "PRESENT" | "MISSING">;
  notes?: string;
};

function normalizeChecklist(
  resource: Resource,
  checklist: Record<string, "PRESENT" | "MISSING">,
): Record<string, "PRESENT" | "MISSING"> {
  const unknown = Object.keys(checklist).filter(
    (key) => !resource.accessories.includes(key),
  );
  if (unknown.length > 0) {
    throw errors.validation([
      {
        field: "checklist",
        code: "UNKNOWN_ACCESSORY",
        message: `Unknown accessory: ${unknown[0]}.`,
      },
    ]);
  }
  const normalized: Record<string, "PRESENT" | "MISSING"> = {};
  for (const accessory of resource.accessories) {
    normalized[accessory] = checklist[accessory] ?? "MISSING";
  }
  return normalized;
}

function validateConditionInput(
  resource: Resource,
  input: ConditionInput,
): ConditionInput {
  if (
    !["GOOD", "MINOR_WEAR", "DAMAGED", "NOT_WORKING"].includes(input.overallCondition)
  ) {
    throw errors.validation([
      {
        field: "overallCondition",
        code: "REQUIRED",
        message: "Choose an overall condition.",
      },
    ]);
  }
  if ((input.notes ?? "").length > POLICY.notesMax) {
    throw errors.validation([
      {
        field: "notes",
        code: "TOO_LONG",
        message: `Notes must be ${POLICY.notesMax} characters or fewer.`,
      },
    ]);
  }
  return { ...input, checklist: normalizeChecklist(resource, input.checklist) };
}

export function checkoutBooking(
  user: SessionUser,
  bookingId: string,
  input: ConditionInput,
  requestId: string,
  now = new Date(),
): Booking {
  const { booking, resource } = bookingContext(user, bookingId);
  if (!canManageResource(user, resource)) {
    deny(user, "booking.checkout", "booking", bookingId, requestId);
  }
  if (booking.status !== "APPROVED") assertTransition(booking.status, "CHECKED_OUT");
  const windowStart = addMinutes(
    new Date(booking.startAt),
    -POLICY.checkoutWindowBeforeMinutes,
  );
  if (now.getTime() < windowStart.getTime()) {
    throw new AppError(
      "INVALID_TRANSITION",
      `Checkout opens ${POLICY.checkoutWindowBeforeMinutes} minutes before the booking starts.`,
      409,
    );
  }
  if (now.getTime() > new Date(booking.endAt).getTime()) {
    throw new AppError(
      "INVALID_TRANSITION",
      "This booking has already ended and can no longer be checked out.",
      409,
    );
  }
  if (reportsForBooking(bookingId).some((report) => report.type === "CHECKOUT")) {
    throw new AppError("INVALID_TRANSITION", "A checkout report already exists.", 409);
  }
  const normalized = validateConditionInput(resource, input);

  try {
    transactionImmediate(() => {
      insertReport({
        institutionId: user.institutionId,
        bookingId,
        type: "CHECKOUT",
        condition: normalized.overallCondition,
        checklist: normalized.checklist,
        notes: (normalized.notes ?? "").trim(),
        recordedBy: user.id,
      });
      updateBooking(bookingId, { status: "CHECKED_OUT", decidedBy: user.id });
      addHistory({
        bookingId,
        fromStatus: "APPROVED",
        toStatus: "CHECKED_OUT",
        actorId: user.id,
        reasonCode: null,
      });
      writeAudit({
        institutionId: user.institutionId,
        actorId: user.id,
        action: "booking.checked_out",
        entityType: "booking",
        entityId: bookingId,
        metadata: { condition: normalized.overallCondition },
        requestId,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE")) {
      throw new AppError("INVALID_TRANSITION", "A checkout report already exists.", 409);
    }
    mapConflict(error);
  }
  const updated = getBooking(user.institutionId, bookingId);
  if (!updated) throw errors.notFound();
  return updated;
}

export function returnBooking(
  user: SessionUser,
  bookingId: string,
  input: ConditionInput,
  requestId: string,
  now = new Date(),
): { booking: Booking; incidents: Incident[] } {
  const { booking, resource } = bookingContext(user, bookingId);
  if (!canManageResource(user, resource)) {
    deny(user, "booking.return", "booking", bookingId, requestId);
  }
  if (booking.status !== "CHECKED_OUT") assertTransition(booking.status, "RETURNED");
  const checkout = reportsForBooking(bookingId).find(
    (report) => report.type === "CHECKOUT",
  );
  if (!checkout) {
    throw new AppError("INVALID_TRANSITION", "A checkout report is required first.", 409);
  }
  const normalized = validateConditionInput(resource, input);

  const severityOrder = ["GOOD", "MINOR_WEAR", "DAMAGED", "NOT_WORKING"];
  const worse =
    severityOrder.indexOf(normalized.overallCondition) >
    severityOrder.indexOf(checkout.overallCondition);
  const newlyMissing = resource.accessories.filter(
    (item) =>
      checkout.checklist[item] === "PRESENT" && normalized.checklist[item] === "MISSING",
  );
  const damaged = ["DAMAGED", "NOT_WORKING"].includes(normalized.overallCondition);
  const discrepancy = worse || newlyMissing.length > 0 || damaged;
  const late =
    now.getTime() > new Date(booking.endAt).getTime() + POLICY.lateGraceMinutes * 60_000;
  const createdIncidents: Incident[] = [];

  transactionImmediate(() => {
    insertReport({
      institutionId: user.institutionId,
      bookingId,
      type: "RETURN",
      condition: normalized.overallCondition,
      checklist: normalized.checklist,
      notes: (normalized.notes ?? "").trim(),
      recordedBy: user.id,
    });
    updateBooking(bookingId, { status: "RETURNED", late, discrepancy });
    addHistory({
      bookingId,
      fromStatus: "CHECKED_OUT",
      toStatus: "RETURNED",
      actorId: user.id,
      reasonCode: discrepancy ? "DISCREPANCY" : null,
    });
    writeAudit({
      institutionId: user.institutionId,
      actorId: user.id,
      action: "booking.returned",
      entityType: "booking",
      entityId: bookingId,
      metadata: { condition: normalized.overallCondition, discrepancy, late },
      requestId,
    });

    if (discrepancy) {
      const type = newlyMissing.length > 0 ? "MISSING_ITEM" : "DAMAGE";
      const severity = normalized.overallCondition === "NOT_WORKING" ? "HIGH" : "MEDIUM";
      const detail =
        newlyMissing.length > 0
          ? `Missing at return: ${newlyMissing.join(", ")}.`
          : `Condition changed from ${checkout.overallCondition} to ${normalized.overallCondition}.`;
      const incident = insertIncident({
        institutionId: user.institutionId,
        resourceId: resource.id,
        bookingId,
        reporterId: user.id,
        type,
        severity,
        description: `${detail} Created automatically from the return condition report.`,
      });
      createdIncidents.push(incident);
      writeAudit({
        institutionId: user.institutionId,
        actorId: user.id,
        action: "incident.created",
        entityType: "incident",
        entityId: incident.id,
        metadata: { type, severity, automatic: true },
        requestId,
      });
    }

    if (late) {
      const incident = insertIncident({
        institutionId: user.institutionId,
        resourceId: resource.id,
        bookingId,
        reporterId: user.id,
        type: "LATE_RETURN",
        severity: "LOW",
        description: `Returned after the ${POLICY.lateGraceMinutes}-minute grace period.`,
      });
      createdIncidents.push(incident);
      writeAudit({
        institutionId: user.institutionId,
        actorId: user.id,
        action: "incident.created",
        entityType: "incident",
        entityId: incident.id,
        metadata: { type: "LATE_RETURN", severity: "LOW", automatic: true },
        requestId,
      });
    }
  });

  const updated = getBooking(user.institutionId, bookingId);
  if (!updated) throw errors.notFound();
  return { booking: updated, incidents: createdIncidents };
}

export type BookingDetail = {
  booking: Booking;
  resource: Resource;
  history: ReturnType<typeof bookingHistory>;
  reports: ReturnType<typeof reportsForBooking>;
  incidents: Incident[];
  waitlist: WaitlistView | null;
  canApprove: boolean;
  canCheckout: boolean;
  canReturn: boolean;
  canCancel: boolean;
  checkoutOpenAt: string;
};

export function bookingDetail(user: SessionUser, bookingId: string): BookingDetail {
  const { booking, resource } = bookingContext(user, bookingId);
  const isRequester = booking.requesterId === user.id;
  const manager = canManageResource(user, resource);
  if (!isRequester && !manager) throw errors.notFound();
  return {
    booking,
    resource,
    history: bookingHistory(bookingId),
    reports: reportsForBooking(bookingId),
    incidents: incidentsForBooking(bookingId),
    waitlist: booking.status === "WAITLISTED" ? waitlistView(booking) : null,
    canApprove:
      booking.status === "PENDING" && canApproveBooking(user, booking, resource),
    canCheckout: booking.status === "APPROVED" && manager,
    canReturn: booking.status === "CHECKED_OUT" && manager,
    canCancel:
      ["PENDING", "WAITLISTED", "APPROVED"].includes(booking.status) &&
      (isRequester || manager),
    checkoutOpenAt: addMinutes(
      new Date(booking.startAt),
      -POLICY.checkoutWindowBeforeMinutes,
    ).toISOString(),
  };
}

export type MyBookings = {
  upcoming: Booking[];
  active: Booking[];
  past: Booking[];
};

export function myBookings(user: SessionUser, now = new Date()): MyBookings {
  expireStaleBookings(now);
  const all = listBookings({
    institutionId: user.institutionId,
    requesterId: user.id,
    limit: 200,
    order: "start_asc",
  });
  const activeStatuses = ["PENDING", "APPROVED", "CHECKED_OUT", "WAITLISTED"];
  const upcoming: Booking[] = [];
  const active: Booking[] = [];
  const past: Booking[] = [];
  for (const booking of all) {
    if (booking.status === "CHECKED_OUT") active.push(booking);
    else if (activeStatuses.includes(booking.status) && new Date(booking.endAt) > now)
      upcoming.push(booking);
    else past.push(booking);
  }
  return { upcoming, active, past };
}

export type QueueItem = {
  booking: Booking;
  requesterName: string;
  usageHours30d: number;
  eligibility: { eligible: boolean; reasons: { code: string; message: string }[] };
  rank: number;
  competingCount: number;
  explanation: string;
  intendedHours: number;
  resource: Resource;
};

export function requestQueue(
  user: SessionUser,
  now = new Date(),
): {
  items: QueueItem[];
  overdue: Booking[];
  missedPickups: Booking[];
} {
  expireStaleBookings(now);
  const bookings = listBookings({
    institutionId: user.institutionId,
    resourceOwnerId: user.role === "ADMIN" ? undefined : user.id,
    statuses: ["PENDING"],
    limit: 200,
  });
  const items: QueueItem[] = [];
  for (const booking of bookings) {
    const resource = getResourceById(user.institutionId, booking.resourceId);
    const requester = getUserById(booking.requesterId);
    if (!resource || !requester) continue;
    const ranked = competingRanking(resource.id, booking.startAt, booking.endAt, now);
    const me = ranked.find((candidate) => candidate.bookingId === booking.id);
    const snapshot = me ? buildSnapshot(me, ranked.length) : null;
    const eligibility = evaluateEligibility(requester, resource, {
      requestedHours: durationHours(new Date(booking.startAt), new Date(booking.endAt)),
      excludeBookingId: booking.id,
      now,
    });
    items.push({
      booking,
      requesterName: booking.requesterName ?? "Member",
      usageHours30d: snapshot?.usageHours30d ?? 0,
      eligibility,
      rank: snapshot?.rank ?? 1,
      competingCount: ranked.length,
      explanation: snapshot
        ? `Rank #${snapshot.rank} of ${snapshot.competingCount}. 30-day usage: ${snapshot.usageHours30d.toFixed(1)} h.`
        : "",
      intendedHours: durationHours(new Date(booking.startAt), new Date(booking.endAt)),
      resource,
    });
  }
  items.sort((a, b) => {
    if (a.resource.id !== b.resource.id)
      return a.resource.name.localeCompare(b.resource.name);
    const byStart = a.booking.startAt.localeCompare(b.booking.startAt);
    if (byStart !== 0) return byStart;
    return a.rank - b.rank;
  });

  const mine = listBookings({
    institutionId: user.institutionId,
    resourceOwnerId: user.role === "ADMIN" ? undefined : user.id,
    statuses: ["APPROVED", "CHECKED_OUT"],
    limit: 200,
  });
  const overdue = mine.filter(
    (b) => b.status === "CHECKED_OUT" && new Date(b.endAt).getTime() < now.getTime(),
  );
  const missedPickups = mine.filter(
    (b) =>
      b.status === "APPROVED" &&
      now.getTime() >
        new Date(b.startAt).getTime() + POLICY.noShowAfterMinutes * 60_000 &&
      now.getTime() < new Date(b.endAt).getTime(),
  );
  return { items, overdue, missedPickups };
}

export function queueCount(user: SessionUser): number {
  return listBookings({
    institutionId: user.institutionId,
    resourceOwnerId: user.role === "ADMIN" ? undefined : user.id,
    statuses: ["PENDING"],
    limit: 200,
  }).length;
}

export function formatBookingWindow(booking: Booking, timeZone: string): string {
  return formatRange(booking.startAt, booking.endAt, timeZone);
}

export function requesterUsage(
  user: SessionUser,
  requesterId: string,
  now = new Date(),
): number {
  const since = new Date(
    now.getTime() - POLICY.usageWindowDays * 86_400_000,
  ).toISOString();
  return usageHours30d(requesterId, since, now.toISOString());
}

export function incidentsVisibleForBooking(
  user: SessionUser,
  bookingId: string,
): Incident[] {
  return listIncidents({
    institutionId: user.institutionId,
    viewerId: user.id,
    viewerRole: user.role,
    bookingId,
    limit: 50,
  });
}

export function weekHoursFor(
  user: SessionUser,
  now = new Date(),
): { used: number; cap: number } {
  const week = localWeekRange(now, user.timezone);
  return {
    used: sumHours(
      user.id,
      POLICY.weeklyHoursStatuses,
      week.start.toISOString(),
      week.end.toISOString(),
    ),
    cap: POLICY.maxWeeklyHours,
  };
}
