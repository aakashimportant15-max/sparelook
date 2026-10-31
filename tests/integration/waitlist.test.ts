import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  approveBooking,
  cancelBooking,
  createBooking,
} from "../../src/server/services/bookings";
import { createResourceForAdmin } from "../../src/server/services/resources";
import { insertBooking } from "../../src/server/repos/bookings";
import { getBooking, bookingHistory } from "../../src/server/repos/bookings";
import { setUserStatus } from "../../src/server/repos/users";
import { listAuditEvents } from "../../src/server/audit";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { appError, localTime, sessionUser } from "../helpers/fixtures";

const REQUEST = "req-wait";

function book(
  userId: string,
  resourceId: string,
  start: Date,
  end: Date,
  key: string,
  waitlist = false,
) {
  return createBooking(
    sessionUser(userId),
    {
      resourceId,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      purpose: "Waitlist integration scenario",
      joinWaitlist: waitlist,
    },
    key,
    REQUEST,
  ).booking;
}

describe("TC-WAIT: waitlist promotion", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-WAIT-01 cancelling an approved booking promotes the best waitlisted request", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    const dev = book("u-dev", "r05", start, end, "wait-01-dev");
    const rohan = book("u-rohan", "r05", start, end, "wait-01-rohan", true);
    expect(rohan.status).toBe("WAITLISTED");

    cancelBooking(sessionUser("u-dev"), dev.id, undefined, REQUEST);
    const promoted = getBooking(DEMO_INSTITUTION_ID, rohan.id);
    expect(promoted?.status).toBe("APPROVED");
    const history = bookingHistory(rohan.id);
    expect(history.at(-1)?.reasonCode).toBe("PROMOTED_FROM_WAITLIST");
    expect(history.at(-1)?.fromStatus).toBe("WAITLISTED");
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "booking.promoted",
      }).some((event) => event.entityId === rohan.id),
    ).toBe(true);
  });

  it("TC-WAIT-02 promotion into an approval-gated resource lands back in the owner queue", () => {
    const now = new Date();
    const resource = createResourceForAdmin(
      sessionUser("u-meera"),
      {
        name: "Gated Test Rig",
        type: "TEST_EQUIPMENT",
        assetTag: "RB-TST-GATED",
        location: "Test Lab",
        description: "Needs owner approval.",
        accessories: ["Main unit"],
        maxDurationHours: 24,
        approvalRequired: true,
        openTime: null,
        closeTime: null,
        allowedGroups: [],
        requiredTrainings: [],
        ownerId: "u-kabir",
      },
      REQUEST,
    );
    const start = localTime(now, 3, 10);
    const end = localTime(now, 3, 12);
    const ananya = book("u-ananya", resource.id, start, end, "wait-02-ananya");
    expect(ananya.status).toBe("PENDING");
    approveBooking(sessionUser("u-kabir"), ananya.id, undefined, REQUEST);
    const sana = book("u-sana", resource.id, start, end, "wait-02-sana", true);
    expect(sana.status).toBe("WAITLISTED");

    cancelBooking(
      sessionUser("u-kabir"),
      ananya.id,
      "Released after schedule change",
      REQUEST,
    );
    const promoted = getBooking(DEMO_INSTITUTION_ID, sana.id);
    expect(promoted?.status).toBe("PENDING");
  });

  it("TC-WAIT-03 suspended waitlisted members are skipped during promotion", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    const dev = book("u-dev", "r05", start, end, "wait-03-dev");
    const rohan = book("u-rohan", "r05", start, end, "wait-03-rohan", true);
    expect(rohan.status).toBe("WAITLISTED");
    setUserStatus(DEMO_INSTITUTION_ID, "u-rohan", "SUSPENDED");
    cancelBooking(sessionUser("u-dev"), dev.id, undefined, REQUEST);
    expect(getBooking(DEMO_INSTITUTION_ID, rohan.id)?.status).toBe("WAITLISTED");
  });

  it("TC-WAIT-04 promotion picks the member with lower 30-day usage", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    const dev = book("u-dev", "r05", start, end, "wait-04-dev");
    const sana = book("u-sana", "r05", start, end, "wait-04-sana", true);
    const ananya = book("u-ananya", "r05", start, end, "wait-04-ananya", true);
    expect(sana.status).toBe("WAITLISTED");
    expect(ananya.status).toBe("WAITLISTED");
    cancelBooking(sessionUser("u-dev"), dev.id, undefined, REQUEST);
    expect(getBooking(DEMO_INSTITUTION_ID, ananya.id)?.status).toBe("APPROVED");
    expect(getBooking(DEMO_INSTITUTION_ID, sana.id)?.status).toBe("WAITLISTED");
  });

  it("TC-WAIT-06 a superseded request records a readable decision reason and keeps its audit history", () => {
    const now = new Date();
    const resource = createResourceForAdmin(
      sessionUser("u-meera"),
      {
        name: "Supersede Rationale Rig",
        type: "TEST_EQUIPMENT",
        assetTag: "RB-TST-SUPERSEDE",
        location: "Test Lab",
        description: "Needs owner approval.",
        accessories: ["Main unit"],
        maxDurationHours: 24,
        approvalRequired: true,
        openTime: null,
        closeTime: null,
        allowedGroups: [],
        requiredTrainings: [],
        ownerId: "u-kabir",
      },
      REQUEST,
    );
    const start = localTime(now, 4, 10);
    const end = localTime(now, 4, 12);
    const first = book("u-ananya", resource.id, start, end, "wait-06-ananya");
    const second = book("u-sana", resource.id, start, end, "wait-06-sana");
    expect(second.status).toBe("PENDING");

    approveBooking(sessionUser("u-kabir"), first.id, undefined, REQUEST);

    const superseded = getBooking(DEMO_INSTITUTION_ID, second.id);
    expect(superseded?.status).toBe("WAITLISTED");
    expect(superseded?.decisionReason).toMatch(/approved first/i);
    const history = bookingHistory(second.id);
    const supersedeEntry = history.find(
      (entry) => entry.toStatus === "WAITLISTED" && entry.fromStatus === "PENDING",
    );
    expect(supersedeEntry?.reasonCode).toBe("SUPERSEDED_BY_APPROVED_BOOKING");
  });

  it("TC-WAIT-05 members may hold at most two waitlist entries", () => {
    const now = new Date();
    for (let day = 5; day <= 6; day += 1) {
      insertBooking({
        institutionId: DEMO_INSTITUTION_ID,
        resourceId: "r05",
        requesterId: "u-dev",
        startAt: localTime(now, day, 10).toISOString(),
        endAt: localTime(now, day, 12).toISOString(),
        purpose: "Existing waitlist fixture",
        status: "WAITLISTED",
        idempotencyKey: `wait-05-fixture-${day}`,
      });
    }
    const start = localTime(now, 2, 10);
    book("u-rohan", "r05", start, localTime(now, 2, 12), "wait-05-blocker");
    const error = appError(() =>
      book("u-dev", "r05", start, localTime(now, 2, 12), "wait-05-new", true),
    );
    expect(error.code).toBe("NOT_ELIGIBLE");
    expect((error.fields as { code: string }[]).map((field) => field.code)).toContain(
      "LIMIT_WAITLIST",
    );
  });
});
