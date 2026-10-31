import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../../src/db/client";
import {
  getBooking,
  insertBooking,
  insertReport,
  updateBooking,
} from "../../src/server/repos/bookings";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";

function seedBookingWindow() {
  const booking = getBooking(DEMO_INSTITUTION_ID, "b-approved-r01");
  if (!booking) throw new Error("seed booking missing");
  return booking;
}

function pendingOverlap(key: string) {
  const seeded = seedBookingWindow();
  return insertBooking({
    institutionId: DEMO_INSTITUTION_ID,
    resourceId: "r01",
    requesterId: "u-dev",
    startAt: seeded.startAt,
    endAt: seeded.endAt,
    purpose: "Pending overlap fixture",
    status: "PENDING",
    idempotencyKey: key,
  });
}

describe("TC-DB: database integrity guards", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-DB-01 the database rejects overlapping approved bookings (BR-05b)", () => {
    const seeded = seedBookingWindow();
    expect(() =>
      insertBooking({
        institutionId: DEMO_INSTITUTION_ID,
        resourceId: "r01",
        requesterId: "u-dev",
        startAt: seeded.startAt,
        endAt: seeded.endAt,
        purpose: "Overlap attempt",
        status: "APPROVED",
        idempotencyKey: "db-01",
      }),
    ).toThrow(/BOOKING_CONFLICT/);
  });

  it("TC-DB-02 the database rejects promoting an overlapping request to approved", () => {
    const pending = pendingOverlap("db-02");
    expect(() => updateBooking(pending.id, { status: "APPROVED" })).toThrow(
      /BOOKING_CONFLICT/,
    );
    expect(getBooking(DEMO_INSTITUTION_ID, pending.id)?.status).toBe("PENDING");
  });

  it("TC-DB-03 pending requests may overlap while competing for a slot", () => {
    const first = pendingOverlap("db-03-a");
    const second = pendingOverlap("db-03-b");
    expect(first.id).not.toBe(second.id);
  });

  it("TC-DB-04 idempotency keys are unique per requester", () => {
    const seeded = seedBookingWindow();
    expect(() =>
      insertBooking({
        institutionId: DEMO_INSTITUTION_ID,
        resourceId: "r01",
        requesterId: "u-dev",
        startAt: seeded.startAt,
        endAt: seeded.endAt,
        purpose: "Duplicate key",
        status: "PENDING",
        idempotencyKey: "seed-b-approved-r01",
      }),
    ).not.toThrow();
    const pending = pendingOverlap("db-04");
    expect(() =>
      insertBooking({
        institutionId: DEMO_INSTITUTION_ID,
        resourceId: "r01",
        requesterId: "u-dev",
        startAt: pending.startAt,
        endAt: pending.endAt,
        purpose: "Duplicate key",
        status: "PENDING",
        idempotencyKey: "db-04",
      }),
    ).toThrow(/UNIQUE/);
  });

  it("TC-DB-05 bookings must end after they start and reference real resources", () => {
    const seeded = seedBookingWindow();
    expect(() =>
      insertBooking({
        institutionId: DEMO_INSTITUTION_ID,
        resourceId: "r01",
        requesterId: "u-dev",
        startAt: seeded.endAt,
        endAt: seeded.startAt,
        purpose: "Time travel",
        status: "PENDING",
        idempotencyKey: "db-05-time",
      }),
    ).toThrow(/CHECK constraint/);
    expect(() =>
      insertBooking({
        institutionId: DEMO_INSTITUTION_ID,
        resourceId: "does-not-exist",
        requesterId: "u-dev",
        startAt: seeded.startAt,
        endAt: seeded.endAt,
        purpose: "Unknown resource",
        status: "PENDING",
        idempotencyKey: "db-05-fk",
      }),
    ).toThrow(/FOREIGN KEY/);
  });

  it("TC-DB-06 condition reports are unique per booking and type", () => {
    insertReport({
      institutionId: DEMO_INSTITUTION_ID,
      bookingId: "b-approved-r01",
      type: "CHECKOUT",
      condition: "GOOD",
      checklist: {},
      notes: "First",
      recordedBy: "u-kabir",
    });
    expect(() =>
      insertReport({
        institutionId: DEMO_INSTITUTION_ID,
        bookingId: "b-approved-r01",
        type: "CHECKOUT",
        condition: "GOOD",
        checklist: {},
        notes: "Second",
        recordedBy: "u-kabir",
      }),
    ).toThrow(/UNIQUE/);
  });

  it("TC-DB-07 bookings, reports and incidents cannot be deleted", () => {
    expect(() =>
      getDb().prepare("DELETE FROM bookings WHERE id = ?").run("b-approved-r01"),
    ).toThrow(/BOOKINGS_APPEND_ONLY/);
    expect(() =>
      getDb()
        .prepare("DELETE FROM condition_reports WHERE booking_id = ?")
        .run("b-hist-1"),
    ).toThrow(/REPORTS_APPEND_ONLY/);
    expect(() =>
      getDb().prepare("DELETE FROM incidents WHERE id = ?").run("inc-hist-1"),
    ).toThrow(/INCIDENTS_APPEND_ONLY/);
  });

  it("TC-DB-08 the demo seed covers every lifecycle state", () => {
    const rows = getDb()
      .prepare("SELECT status, COUNT(*) AS count FROM bookings GROUP BY status")
      .all() as { status: string; count: number }[];
    const byStatus = Object.fromEntries(rows.map((row) => [row.status, row.count]));
    for (const status of [
      "PENDING",
      "APPROVED",
      "WAITLISTED",
      "CHECKED_OUT",
      "RETURNED",
    ]) {
      expect(byStatus[status]).toBeGreaterThan(0);
    }
    const activeReports = getDb()
      .prepare(
        "SELECT c.type FROM condition_reports c WHERE c.booking_id = 'b-active-r06'",
      )
      .all() as { type: string }[];
    expect(activeReports).toEqual([{ type: "CHECKOUT" }]);
    const waitlistHistory = getDb()
      .prepare(
        "SELECT to_status AS toStatus, reason_code AS reasonCode FROM booking_status_history WHERE booking_id = 'b-wait-sana-r01' ORDER BY created_at",
      )
      .all() as { toStatus: string; reasonCode: string | null }[];
    expect(waitlistHistory.map((row) => row.toStatus)).toEqual(["PENDING", "WAITLISTED"]);
    expect(waitlistHistory[1].reasonCode).toBe("JOINED_WAITLIST");
  });
});
