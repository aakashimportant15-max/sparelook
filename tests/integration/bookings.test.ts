import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  approveBooking,
  bookingDetail,
  cancelBooking,
  createBooking,
  expireStaleBookings,
  myBookings,
  rejectBooking,
  requestQueue,
} from "../../src/server/services/bookings";
import { createResourceForAdmin } from "../../src/server/services/resources";
import { getBooking } from "../../src/server/repos/bookings";
import { bookingHistory } from "../../src/server/repos/bookings";
import { listAuditEvents } from "../../src/server/audit";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { appError, expectAppError, localTime, sessionUser } from "../helpers/fixtures";
import type { Resource } from "../../src/domain/types";

const REQUEST = "req-test";

function bookOn(
  userId: string,
  resourceId: string,
  start: Date,
  end: Date,
  key: string,
  options: { joinWaitlist?: boolean; purpose?: string } = {},
) {
  return createBooking(
    sessionUser(userId),
    {
      resourceId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      purpose: options.purpose ?? "Club documentary shoot",
      joinWaitlist: options.joinWaitlist,
    },
    key,
    REQUEST,
  );
}

function makeManagedResource(
  overrides: Partial<Parameters<typeof createResourceForAdmin>[1]> = {},
): Resource {
  return createResourceForAdmin(
    sessionUser("u-meera"),
    {
      name: "Test Bay Rig",
      type: "TEST_EQUIPMENT",
      assetTag: `RB-TST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      location: "Test Lab",
      description: "Resource created by tests.",
      accessories: ["Main unit", "Cable"],
      maxDurationHours: 48,
      approvalRequired: true,
      openTime: null,
      closeTime: null,
      allowedGroups: [],
      requiredTrainings: [],
      ownerId: "u-kabir",
      ...overrides,
    },
    REQUEST,
  );
}

describe("TC-BOOK: booking creation, conflicts and decisions", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-BOOK-01 auto-approves resources that do not need approval and records history", () => {
    const now = new Date();
    const result = bookOn(
      "u-dev",
      "r05",
      localTime(now, 2, 10),
      localTime(now, 2, 12),
      "book-01",
    );
    expect(result.replay).toBe(false);
    expect(result.booking.status).toBe("APPROVED");
    const history = bookingHistory(result.booking.id).map((entry) => entry.reasonCode);
    expect(history).toContain("AUTO_APPROVED");
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "booking.approved",
      }).some((event) => event.entityId === result.booking.id && event.actorId === null),
    ).toBe(true);
  });

  it("TC-BOOK-02 creates a pending request when the owner must approve", () => {
    const now = new Date();
    const resource = makeManagedResource();
    const result = bookOn(
      "u-dev",
      resource.id,
      localTime(now, 3, 10),
      localTime(now, 3, 12),
      "book-02",
    );
    expect(result.booking.status).toBe("PENDING");
    const history = bookingHistory(result.booking.id);
    expect(history.map((entry) => entry.toStatus)).toEqual(["PENDING"]);
  });

  it("TC-BOOK-03 replays the same idempotency key instead of duplicating a booking", () => {
    const now = new Date();
    const first = bookOn(
      "u-dev",
      "r05",
      localTime(now, 2, 10),
      localTime(now, 2, 12),
      "book-03",
    );
    const replay = bookOn(
      "u-dev",
      "r05",
      localTime(now, 4, 10),
      localTime(now, 4, 12),
      "book-03",
    );
    expect(replay.replay).toBe(true);
    expect(replay.booking.id).toBe(first.booking.id);
    expect(replay.booking.startAt).toBe(first.booking.startAt);
    const otherUser = bookOn(
      "u-rohan",
      "r05",
      localTime(now, 3, 10),
      localTime(now, 3, 12),
      "book-03",
    );
    expect(otherUser.booking.id).not.toBe(first.booking.id);
  });

  it("TC-BOOK-04 blocks overlapping approved bookings with a 409 booking conflict", () => {
    const now = new Date();
    bookOn("u-dev", "r05", localTime(now, 2, 10), localTime(now, 2, 12), "book-04a");
    const error = appError(() =>
      bookOn("u-rohan", "r05", localTime(now, 2, 11), localTime(now, 2, 13), "book-04b"),
    );
    expect(error.code).toBe("BOOKING_CONFLICT");
    expect(error.status).toBe(409);
    expect((error.extra as { conflict?: { startAt: string } }).conflict?.startAt).toBe(
      localTime(now, 2, 10).toISOString(),
    );
    // Touching windows do not conflict.
    const touching = bookOn(
      "u-rohan",
      "r05",
      localTime(now, 2, 12),
      localTime(now, 2, 14),
      "book-04c",
    );
    expect(touching.booking.status).toBe("APPROVED");
  });

  it("TC-BOOK-05 waitlists an overlapping request when the member asks to wait", () => {
    const now = new Date();
    bookOn("u-dev", "r05", localTime(now, 2, 10), localTime(now, 2, 12), "book-05a");
    const waitlisted = bookOn(
      "u-rohan",
      "r05",
      localTime(now, 2, 10),
      localTime(now, 2, 12),
      "book-05b",
      { joinWaitlist: true },
    );
    expect(waitlisted.booking.status).toBe("WAITLISTED");
    expect(bookingHistory(waitlisted.booking.id)[0].reasonCode).toBe("JOINED_WAITLIST");
  });

  it("TC-BOOK-06 enforces groups, trainings, self-booking and resource availability", () => {
    const now = new Date();
    const groupError = appError(() =>
      bookOn("u-dev", "r01", localTime(now, 2, 10), localTime(now, 2, 12), "book-06a"),
    );
    expect(groupError.code).toBe("NOT_ELIGIBLE");
    const codes = (groupError.fields as { code: string }[]).map((field) => field.code);
    expect(codes).toEqual(expect.arrayContaining(["MISSING_GROUP", "MISSING_TRAINING"]));

    const selfError = appError(() =>
      bookOn("u-kabir", "r01", localTime(now, 2, 10), localTime(now, 2, 12), "book-06b"),
    );
    expect((selfError.fields as { code: string }[]).map((f) => f.code)).toContain(
      "SELF_BOOKING",
    );

    expectAppError(
      () =>
        bookOn("u-dev", "r09", localTime(now, 2, 10), localTime(now, 2, 12), "book-06c"),
      "RESOURCE_UNAVAILABLE",
    );
    expectAppError(
      () =>
        bookOn("u-dev", "r10", localTime(now, 2, 10), localTime(now, 2, 12), "book-06d"),
      "RESOURCE_UNAVAILABLE",
    );
  });

  it("TC-BOOK-07 returns field-level validation errors", () => {
    const now = new Date();
    const error = appError(() =>
      bookOn("u-dev", "r05", localTime(now, -1, 10), localTime(now, -1, 12), "book-07"),
    );
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.status).toBe(422);
    expect((error.fields as { code: string }[]).map((field) => field.code)).toContain(
      "START_IN_PAST",
    );
  });

  it("TC-BOOK-08 limits open bookings per member", () => {
    const now = new Date();
    for (let day = 2; day <= 4; day += 1) {
      bookOn(
        "u-dev",
        "r05",
        localTime(now, day, 9),
        localTime(now, day, 10),
        `book-08-${day}`,
      );
    }
    const error = appError(() =>
      bookOn(
        "u-dev",
        "r05",
        localTime(now, 5, 9),
        localTime(now, 5, 10),
        "book-08-fourth",
      ),
    );
    expect(error.code).toBe("NOT_ELIGIBLE");
    expect((error.fields as { code: string }[]).map((f) => f.code)).toContain(
      "LIMIT_OPEN_BOOKINGS",
    );
  });

  it("TC-BOOK-09 owner approval of the top-ranked request supersedes competitors", () => {
    const result = approveBooking(
      sessionUser("u-kabir"),
      "b-pending-ananya-r02",
      undefined,
      REQUEST,
    );
    expect(result.booking.status).toBe("APPROVED");
    expect(result.snapshot.rank).toBe(1);
    expect(result.snapshot.competingCount).toBe(2);
    const superseded = getBooking(DEMO_INSTITUTION_ID, "b-pending-sana-r02");
    expect(superseded?.status).toBe("WAITLISTED");
    const history = bookingHistory("b-pending-sana-r02");
    expect(history.at(-1)?.reasonCode).toBe("SUPERSEDED_BY_APPROVED_BOOKING");
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "booking.waitlisted",
      }).some((event) => event.entityId === "b-pending-sana-r02"),
    ).toBe(true);
  });

  it("TC-BOOK-10 overriding FairShare ranking requires a substantial reason", () => {
    const kabir = sessionUser("u-kabir");
    expectAppError(
      () => approveBooking(kabir, "b-pending-sana-r02", undefined, REQUEST),
      "OVERRIDE_REQUIRED",
    );
    expectAppError(
      () => approveBooking(kabir, "b-pending-sana-r02", "short", REQUEST),
      "OVERRIDE_REQUIRED",
    );
    const reason = "Second requester has a deadline this week";
    const result = approveBooking(kabir, "b-pending-sana-r02", reason, REQUEST);
    expect(result.booking.status).toBe("APPROVED");
    expect(result.booking.decisionReason).toBe(reason);
    expect(result.snapshot.rank).toBe(2);
    const history = bookingHistory("b-pending-sana-r02").at(-1);
    expect(history?.reasonCode).toBe("FAIRSHARE_OVERRIDE");
    expect(history?.reasonText).toBe(reason);
    expect(getBooking(DEMO_INSTITUTION_ID, "b-pending-ananya-r02")?.status).toBe(
      "WAITLISTED",
    );
  });

  it("TC-BOOK-11 refuses to approve a request that is not pending", () => {
    expectAppError(
      () => approveBooking(sessionUser("u-kabir"), "b-approved-r01", undefined, REQUEST),
      "INVALID_TRANSITION",
    );
  });

  it("TC-BOOK-12 rejecting requires a reason and only works while pending", () => {
    const kabir = sessionUser("u-kabir");
    const error = appError(() =>
      rejectBooking(kabir, "b-pending-sana-r02", undefined, REQUEST),
    );
    expect(error.code).toBe("VALIDATION_FAILED");
    expect((error.fields as { code: string }[])[0].code).toBe("REASON_REQUIRED");
    const rejected = rejectBooking(
      kabir,
      "b-pending-sana-r02",
      "Kit is reserved for the film department",
      REQUEST,
    );
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.decisionReason).toContain("reserved");
    expectAppError(
      () => rejectBooking(kabir, "b-approved-r01", "Too late now", REQUEST),
      "INVALID_TRANSITION",
    );
  });

  it("TC-BOOK-13 requesters cancel their own request; managers need a reason", () => {
    const now = new Date();
    const created = bookOn(
      "u-dev",
      "r05",
      localTime(now, 3, 10),
      localTime(now, 3, 12),
      "book-13",
    );
    const cancelled = cancelBooking(
      sessionUser("u-dev"),
      created.booking.id,
      undefined,
      REQUEST,
    );
    expect(cancelled.status).toBe("CANCELLED");

    expectAppError(
      () => cancelBooking(sessionUser("u-kabir"), "b-approved-r01", undefined, REQUEST),
      "VALIDATION_FAILED",
    );
    const managerCancelled = cancelBooking(
      sessionUser("u-kabir"),
      "b-approved-r01",
      "Equipment recalled for maintenance",
      REQUEST,
    );
    expect(managerCancelled.status).toBe("CANCELLED");
  });

  it("TC-BOOK-14 a booking that already started cannot be cancelled by the requester", () => {
    const booking = getBooking(DEMO_INSTITUTION_ID, "b-approved-r01");
    if (!booking) throw new Error("seed booking missing");
    const afterStart = new Date(new Date(booking.startAt).getTime() + 60_000);
    expectAppError(
      () =>
        cancelBooking(sessionUser("u-rohan"), booking.id, undefined, REQUEST, afterStart),
      "INVALID_TRANSITION",
    );
  });

  it("TC-BOOK-15 expired requests are closed with history and audit entries", () => {
    const now = new Date();
    const resource = makeManagedResource();
    const start = localTime(now, 7, 10);
    const created = bookOn("u-dev", resource.id, start, localTime(now, 7, 12), "book-15");
    expect(created.booking.status).toBe("PENDING");
    const expired = expireStaleBookings(new Date(start.getTime() + 3_600_000));
    expect(expired).toBeGreaterThanOrEqual(1);
    expect(getBooking(DEMO_INSTITUTION_ID, created.booking.id)?.status).toBe("EXPIRED");
    expect(bookingHistory(created.booking.id).at(-1)?.reasonCode).toBe(
      "START_TIME_PASSED",
    );
  });

  it("TC-BOOK-16 owner queue ranks competing requests deterministically", () => {
    const queue = requestQueue(sessionUser("u-kabir"));
    expect(queue.items).toHaveLength(2);
    expect(queue.items[0].booking.id).toBe("b-pending-ananya-r02");
    expect(queue.items[0].rank).toBe(1);
    expect(queue.items[0].competingCount).toBe(2);
    expect(queue.items[0].explanation).toContain("Rank #1 of 2");
    expect(queue.items[1].booking.id).toBe("b-pending-sana-r02");
    expect(queue.items[1].rank).toBe(2);
    const adminQueue = requestQueue(sessionUser("u-meera"));
    expect(adminQueue.items).toHaveLength(2);
  });

  it("TC-BOOK-17 booking detail exposes role-appropriate actions", () => {
    const rohanView = bookingDetail(sessionUser("u-rohan"), "b-approved-r01");
    expect(rohanView.booking.status).toBe("APPROVED");
    expect(rohanView.canCancel).toBe(true);
    expect(rohanView.canCheckout).toBe(false);
    expect(rohanView.canApprove).toBe(false);
    expect(new Date(rohanView.checkoutOpenAt).getTime()).toBe(
      new Date(rohanView.booking.startAt).getTime() - 30 * 60_000,
    );
    const ownerView = bookingDetail(sessionUser("u-kabir"), "b-approved-r01");
    expect(ownerView.canCheckout).toBe(true);
    const requesterPending = bookingDetail(
      sessionUser("u-ananya"),
      "b-pending-ananya-r02",
    );
    expect(requesterPending.canApprove).toBe(false);
    expect(requesterPending.canCancel).toBe(true);
  });

  it("TC-BOOK-18 my bookings separates upcoming, active and past", () => {
    const mine = myBookings(sessionUser("u-rohan"));
    expect(mine.upcoming.map((booking) => booking.id)).toContain("b-approved-r01");
    expect(mine.past.map((booking) => booking.id)).toContain("b-hist-2");
    expect(mine.active).toEqual([]);
  });

  it("TC-BOOK-19 a cancelled booking frees the slot for a new request", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    const first = bookOn("u-dev", "r05", start, end, "book-19a").booking;
    expect(first.status).toBe("APPROVED");
    expect(appError(() => bookOn("u-rohan", "r05", start, end, "book-19b")).code).toBe(
      "BOOKING_CONFLICT",
    );

    cancelBooking(sessionUser("u-dev"), first.id, undefined, REQUEST);

    const rebooked = bookOn("u-rohan", "r05", start, end, "book-19c").booking;
    expect(rebooked.status).toBe("APPROVED");
    expect(rebooked.startAt).toBe(start.toISOString());
  });
});
