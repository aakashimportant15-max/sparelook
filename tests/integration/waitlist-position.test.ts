import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  bookingDetail,
  cancelBooking,
  createBooking,
} from "../../src/server/services/bookings";
import { insertBooking } from "../../src/server/repos/bookings";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { expectAppError, localTime, sessionUser } from "../helpers/fixtures";

const REQUEST = "req-wait-view";

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
      purpose: "Waitlist position scenario",
      joinWaitlist: waitlist,
    },
    key,
    REQUEST,
  ).booking;
}

describe("TC-WAITP: live waitlist position", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-WAITP-01 shows the member's real rank and explains the R2 rule", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    book("u-dev", "r05", start, end, "waitp-01-blocker");
    const rohan = book("u-rohan", "r05", start, end, "waitp-01-rohan", true);
    const sana = book("u-sana", "r05", start, end, "waitp-01-sana", true);
    expect(rohan.status).toBe("WAITLISTED");
    expect(sana.status).toBe("WAITLISTED");

    // Sana seeded 30 h of usage; Rohan used 6 h. Lower usage ranks first.
    const rohanView = bookingDetail(sessionUser("u-rohan"), rohan.id).waitlist;
    expect(rohanView).toMatchObject({ position: 1, total: 2, usageHours30d: 6 });
    expect(rohanView?.explanation).toContain("#1 of 2 waitlisted requests");

    const sanaView = bookingDetail(sessionUser("u-sana"), sana.id).waitlist;
    expect(sanaView).toMatchObject({ position: 2, total: 2, usageHours30d: 30 });
    expect(sanaView?.explanation).toContain("#2 of 2 waitlisted requests");
    expect(sanaView?.explanation).toContain("fewer borrowed hours");
    expect(sanaView?.explanation).toContain("eligibility is re-checked");
    // The view is live, not a stored snapshot claiming a guaranteed outcome.
    expect(
      bookingDetail(sessionUser("u-sana"), sana.id).booking.fairnessSnapshot,
    ).toBeNull();
  });

  it("TC-WAITP-02 equally weighted requests keep the earlier request ahead", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    insertBooking({
      institutionId: DEMO_INSTITUTION_ID,
      resourceId: "r05",
      requesterId: "u-dev",
      startAt: localTime(now, -3, 10).toISOString(),
      endAt: localTime(now, -3, 16).toISOString(),
      purpose: "Historical usage fixture",
      status: "RETURNED",
      idempotencyKey: "waitp-02-usage",
    });
    book("u-dev", "r05", start, end, "waitp-02-blocker");
    const first = book("u-dev", "r05", start, end, "waitp-02-dev", true);
    const second = book("u-rohan", "r05", start, end, "waitp-02-rohan", true);
    const devView = bookingDetail(sessionUser("u-dev"), first.id).waitlist;
    const rohanView = bookingDetail(sessionUser("u-rohan"), second.id).waitlist;
    expect(devView).toMatchObject({ position: 1, total: 2, usageHours30d: 6 });
    expect(rohanView).toMatchObject({ position: 2, total: 2, usageHours30d: 6 });
  });

  it("TC-WAITP-03 a member leaving the waitlist moves the others up", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    book("u-dev", "r05", start, end, "waitp-03-blocker");
    const ananya = book("u-ananya", "r05", start, end, "waitp-03-ananya", true);
    const rohan = book("u-rohan", "r05", start, end, "waitp-03-rohan", true);
    expect(bookingDetail(sessionUser("u-rohan"), rohan.id).waitlist).toMatchObject({
      position: 2,
      total: 2,
    });

    cancelBooking(sessionUser("u-ananya"), ananya.id, undefined, REQUEST);

    const after = bookingDetail(sessionUser("u-rohan"), rohan.id).waitlist;
    expect(after).toMatchObject({ position: 1, total: 1 });
    expect(after?.explanation).toContain("only waitlisted request");
  });

  it("TC-WAITP-04 waitlisted requests for other windows are not counted", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    book("u-dev", "r05", start, end, "waitp-04-blocker");
    const rohan = book("u-rohan", "r05", start, end, "waitp-04-rohan", true);
    insertBooking({
      institutionId: DEMO_INSTITUTION_ID,
      resourceId: "r05",
      requesterId: "u-sana",
      startAt: localTime(now, 4, 10).toISOString(),
      endAt: localTime(now, 4, 12).toISOString(),
      purpose: "Different window fixture",
      status: "WAITLISTED",
      idempotencyKey: "waitp-04-other-window",
    });
    expect(bookingDetail(sessionUser("u-rohan"), rohan.id).waitlist).toMatchObject({
      position: 1,
      total: 1,
    });
  });

  it("TC-WAITP-05 only the requester or the resource manager can read the position", () => {
    const now = new Date();
    const start = localTime(now, 2, 10);
    const end = localTime(now, 2, 12);
    book("u-dev", "r05", start, end, "waitp-05-blocker");
    const rohan = book("u-rohan", "r05", start, end, "waitp-05-rohan", true);
    expectAppError(() => bookingDetail(sessionUser("u-isha"), rohan.id), "NOT_FOUND");
    const managed = bookingDetail(sessionUser("u-kabir"), rohan.id);
    expect(managed.waitlist).toMatchObject({ position: 1, total: 1 });
  });

  it("TC-WAITP-06 the demo seed ships a real waitlist ranking", () => {
    const sanaView = bookingDetail(sessionUser("u-sana"), "b-wait-sana-r01").waitlist;
    expect(sanaView).toMatchObject({ position: 2, total: 2, usageHours30d: 30 });
    const ishaView = bookingDetail(sessionUser("u-isha"), "b-wait-isha-r01").waitlist;
    expect(ishaView).toMatchObject({ position: 1, total: 2, usageHours30d: 7 });
  });
});
