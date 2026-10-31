import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { approveBooking } from "../../src/server/services/bookings";
import { bookingHistory } from "../../src/server/repos/bookings";
import { countAuditEvents, listAuditEvents } from "../../src/server/audit";
import { passportFor } from "../../src/server/services/passport";
import { getDb } from "../../src/db/client";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { expectAppError, sessionUser } from "../helpers/fixtures";

const REQUEST = "req-pass";

describe("TC-AUD / TC-PASS: audit trail, history and resource passport", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-AUD-01 approvals append audit events with actor, request id and metadata", () => {
    const before = countAuditEvents(DEMO_INSTITUTION_ID);
    approveBooking(sessionUser("u-kabir"), "b-pending-ananya-r02", undefined, REQUEST);
    expect(countAuditEvents(DEMO_INSTITUTION_ID)).toBeGreaterThan(before);
    const events = listAuditEvents({
      institutionId: DEMO_INSTITUTION_ID,
      action: "booking.approved",
      limit: 10,
    });
    const approveEvent = events.find(
      (event) => event.entityId === "b-pending-ananya-r02",
    );
    expect(approveEvent).toMatchObject({
      actorId: "u-kabir",
      entityType: "booking",
      outcome: "SUCCESS",
      requestId: REQUEST,
    });
    expect(approveEvent?.metadata).toMatchObject({
      rank: 1,
      competingCount: 2,
      override: false,
    });
  });

  it("TC-AUD-02 booking history records each transition in order", () => {
    approveBooking(sessionUser("u-kabir"), "b-pending-ananya-r02", undefined, REQUEST);
    const history = bookingHistory("b-pending-ananya-r02");
    expect(history.map((entry) => entry.toStatus)).toEqual(["PENDING", "APPROVED"]);
    expect(history.at(-1)?.actorName).toBe("Dr. Kabir Rao");
    const superseded = bookingHistory("b-pending-sana-r02");
    expect(superseded.at(-1)).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "WAITLISTED",
      reasonCode: "SUPERSEDED_BY_APPROVED_BOOKING",
    });
  });

  it("TC-AUD-03 audit rows are append-only in the database", () => {
    const id = (
      getDb().prepare("SELECT id FROM audit_events LIMIT 1").get() as { id: string }
    ).id;
    expect(() =>
      getDb().prepare("UPDATE audit_events SET action = 'tampered' WHERE id = ?").run(id),
    ).toThrow(/AUDIT_APPEND_ONLY/);
    expect(() =>
      getDb().prepare("DELETE FROM audit_events WHERE id = ?").run(id),
    ).toThrow(/AUDIT_APPEND_ONLY/);
    expect(
      (
        getDb().prepare("SELECT action FROM audit_events WHERE id = ?").get(id) as {
          action: string;
        }
      ).action,
    ).not.toBe("tampered");
  });

  it("TC-AUD-04 audit queries are scoped to one institution", () => {
    resetDatabase({ includeSecondInstitution: true });
    const lakeEvents = listAuditEvents({ institutionId: "inst-lakeside" });
    expect(lakeEvents).toEqual([]);
    expect(
      listAuditEvents({ institutionId: DEMO_INSTITUTION_ID }).length,
    ).toBeGreaterThan(0);
  });

  it("TC-PASS-01 the owner sees the full passport with audit and condition evidence", () => {
    const passport = passportFor(sessionUser("u-kabir"), "r01");
    expect(passport.full).toBe(true);
    expect(passport.audit.length).toBeGreaterThan(0);
    expect(passport.summary.completedBookings).toBe(3);
    expect(passport.summary.resolvedIncidents).toBe(1);
    expect(passport.summary.lastReturnCondition).toBe("GOOD");
    const titles = passport.timeline.map((event) => event.title);
    expect(titles).toContain("Checkout condition recorded");
    expect(titles).toContain("Return condition recorded");
    expect(titles).toContain("Incident reported");
    expect(passport.timeline.every((event) => event.at)).toBe(true);
    const sorted = [...passport.timeline].sort((a, b) => (a.at < b.at ? -1 : 1));
    expect(passport.timeline).toEqual(sorted);
  });

  it("TC-PASS-02 borrowers see only their own events and aggregate summary stats", () => {
    const passport = passportFor(sessionUser("u-rohan"), "r01");
    expect(passport.full).toBe(false);
    expect(passport.audit).toEqual([]);
    expect(passport.bookings.map((booking) => booking.id).sort()).toEqual([
      "b-approved-r01",
      "b-hist-2",
    ]);
    expect(passport.timeline.every((event) => event.id.startsWith("own_"))).toBe(true);
    expect(passport.incidents.map((incident) => incident.id)).toEqual(["inc-hist-1"]);
    expect(passport.summary.completedBookings).toBe(3);
    expect(passport.summary.lastReturnCondition).toBe("GOOD");
  });

  it("TC-PASS-03 administrators get full passports; hidden resources stay hidden", () => {
    const adminPassport = passportFor(sessionUser("u-meera"), "r01");
    expect(adminPassport.full).toBe(true);
    expect(adminPassport.audit.length).toBeGreaterThan(0);
    expectAppError(() => passportFor(sessionUser("u-kabir"), "r10"), "NOT_FOUND");
    expect(passportFor(sessionUser("u-meera"), "r10").full).toBe(true);
  });
});
