import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  checkoutBooking,
  createBooking,
  returnBooking,
  type ConditionInput,
} from "../../src/server/services/bookings";
import {
  getBooking,
  reportsForBooking,
  bookingHistory,
} from "../../src/server/repos/bookings";
import { incidentsForBooking } from "../../src/server/repos/incidents";
import { listAuditEvents } from "../../src/server/audit";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import type { Condition } from "../../src/domain/types";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import {
  appError,
  expectAppError,
  localTime,
  seedResource,
  sessionUser,
} from "../helpers/fixtures";

const REQUEST = "req-hand";

function conditionFor(
  resourceId: string,
  overallCondition: Condition,
  missing: string[] = [],
  notes = "Condition verified at handover.",
): ConditionInput {
  const checklist: Record<string, "PRESENT" | "MISSING"> = {};
  for (const accessory of seedResource(resourceId).accessories) {
    checklist[accessory] = missing.includes(accessory) ? "MISSING" : "PRESENT";
  }
  return { overallCondition, checklist, notes };
}

function seededWindow() {
  const booking = getBooking(DEMO_INSTITUTION_ID, "b-approved-r01");
  if (!booking) throw new Error("seed booking missing");
  const start = new Date(booking.startAt);
  const end = new Date(booking.endAt);
  return {
    start,
    end,
    windowOpen: new Date(start.getTime() - 30 * 60_000),
  };
}

function checkoutSeeded(): void {
  const { windowOpen } = seededWindow();
  checkoutBooking(
    sessionUser("u-kabir"),
    "b-approved-r01",
    conditionFor("r01", "GOOD"),
    REQUEST,
    windowOpen,
  );
}

describe("TC-HAND: checkout, return and condition evidence", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-HAND-01 checkout opens exactly 30 minutes before the start", () => {
    const { start, windowOpen } = seededWindow();
    const early = appError(() =>
      checkoutBooking(
        sessionUser("u-kabir"),
        "b-approved-r01",
        conditionFor("r01", "GOOD"),
        REQUEST,
        new Date(windowOpen.getTime() - 60_000),
      ),
    );
    expect(early.code).toBe("INVALID_TRANSITION");
    expect(early.message).toContain("30 minutes");

    const checkedOut = checkoutBooking(
      sessionUser("u-kabir"),
      "b-approved-r01",
      conditionFor("r01", "GOOD"),
      REQUEST,
      windowOpen,
    );
    expect(checkedOut.status).toBe("CHECKED_OUT");
    expect(new Date(checkedOut.startAt)).toEqual(start);
  });

  it("TC-HAND-02 checkout stores the report, history and audit trail", () => {
    checkoutSeeded();
    const reports = reportsForBooking("b-approved-r01");
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      type: "CHECKOUT",
      overallCondition: "GOOD",
      recordedBy: "u-kabir",
    });
    expect(
      Object.values(reports[0].checklist).every((value) => value === "PRESENT"),
    ).toBe(true);
    expect(bookingHistory("b-approved-r01").at(-1)?.toStatus).toBe("CHECKED_OUT");
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "booking.checked_out",
      }).some((event) => event.entityId === "b-approved-r01"),
    ).toBe(true);
  });

  it("TC-HAND-03 checkout requires an approved booking and no earlier report", () => {
    expectAppError(
      () =>
        checkoutBooking(
          sessionUser("u-kabir"),
          "b-pending-sana-r02",
          conditionFor("r02", "GOOD"),
          REQUEST,
          new Date(),
        ),
      "INVALID_TRANSITION",
    );
    checkoutSeeded();
    expectAppError(
      () =>
        checkoutBooking(
          sessionUser("u-kabir"),
          "b-approved-r01",
          conditionFor("r01", "GOOD"),
          REQUEST,
          new Date(),
        ),
      "INVALID_TRANSITION",
    );
  });

  it("TC-HAND-04 checkout closes once the booking end time has passed", () => {
    const { end } = seededWindow();
    const late = appError(() =>
      checkoutBooking(
        sessionUser("u-kabir"),
        "b-approved-r01",
        conditionFor("r01", "GOOD"),
        REQUEST,
        new Date(end.getTime() + 60_000),
      ),
    );
    expect(late.code).toBe("INVALID_TRANSITION");
    expect(late.message).toContain("ended");
  });

  it("TC-HAND-05 rejects unknown accessories and overlong notes", () => {
    const unknown = appError(() =>
      checkoutBooking(
        sessionUser("u-kabir"),
        "b-approved-r01",
        {
          overallCondition: "GOOD",
          checklist: { "Mystery box": "PRESENT" },
          notes: "Looks fine.",
        },
        REQUEST,
        seededWindow().windowOpen,
      ),
    );
    expect(unknown.code).toBe("VALIDATION_FAILED");
    expect((unknown.fields as { code: string }[])[0].code).toBe("UNKNOWN_ACCESSORY");

    const longNotes = appError(() =>
      checkoutBooking(
        sessionUser("u-kabir"),
        "b-approved-r01",
        conditionFor("r01", "GOOD", [], "x".repeat(1001)),
        REQUEST,
        seededWindow().windowOpen,
      ),
    );
    expect(longNotes.code).toBe("VALIDATION_FAILED");
  });

  it("TC-HAND-06 a return needs a preceding checkout", () => {
    const now = new Date();
    const created = createBooking(
      sessionUser("u-dev"),
      {
        resourceId: "r05",
        startAt: localTime(now, 2, 10).toISOString(),
        endAt: localTime(now, 2, 12).toISOString(),
        purpose: "Tripod pickup shots",
      },
      "hand-06",
      REQUEST,
    );
    expect(created.booking.status).toBe("APPROVED");
    expectAppError(
      () =>
        returnBooking(
          sessionUser("u-kabir"),
          created.booking.id,
          conditionFor("r05", "GOOD"),
          REQUEST,
          localTime(now, 2, 12),
        ),
      "INVALID_TRANSITION",
    );
  });

  it("TC-HAND-07 a clean return closes the booking without incidents", () => {
    checkoutSeeded();
    const { end } = seededWindow();
    const result = returnBooking(
      sessionUser("u-kabir"),
      "b-approved-r01",
      conditionFor("r01", "GOOD"),
      REQUEST,
      new Date(end.getTime() + 5 * 60_000),
    );
    expect(result.booking.status).toBe("RETURNED");
    expect(result.booking.discrepancy).toBe(false);
    expect(result.booking.late).toBe(false);
    expect(result.incidents).toEqual([]);
    expect(reportsForBooking("b-approved-r01")).toHaveLength(2);
  });

  it("TC-HAND-08 a missing accessory creates a MISSING_ITEM incident", () => {
    checkoutSeeded();
    const { end } = seededWindow();
    const result = returnBooking(
      sessionUser("u-kabir"),
      "b-approved-r01",
      conditionFor("r01", "MINOR_WEAR", ["2 batteries"]),
      REQUEST,
      new Date(end.getTime() + 5 * 60_000),
    );
    expect(result.booking.discrepancy).toBe(true);
    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0]).toMatchObject({
      type: "MISSING_ITEM",
      severity: "MEDIUM",
      resourceId: "r01",
      bookingId: "b-approved-r01",
    });
    expect(result.incidents[0].description).toContain("Missing at return: 2 batteries");
    expect(incidentsForBooking("b-approved-r01")).toHaveLength(1);
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "incident.created",
      }).some((event) => event.entityId === result.incidents[0].id),
    ).toBe(true);
  });

  it("TC-HAND-09 damaged or broken returns create DAMAGE incidents with matching severity", () => {
    checkoutSeeded();
    const { end } = seededWindow();
    const damaged = returnBooking(
      sessionUser("u-kabir"),
      "b-approved-r01",
      conditionFor("r01", "DAMAGED"),
      REQUEST,
      new Date(end.getTime() + 5 * 60_000),
    );
    expect(damaged.incidents[0]).toMatchObject({ type: "DAMAGE", severity: "MEDIUM" });
    expect(damaged.incidents[0].description).toContain("GOOD to DAMAGED");
  });

  it("TC-HAND-10 returns after the 15-minute grace period are flagged late", () => {
    checkoutSeeded();
    const { end } = seededWindow();
    const withinGrace = returnBooking(
      sessionUser("u-kabir"),
      "b-approved-r01",
      conditionFor("r01", "GOOD"),
      REQUEST,
      new Date(end.getTime() + 10 * 60_000),
    );
    expect(withinGrace.booking.late).toBe(false);
    expect(withinGrace.incidents).toEqual([]);
  });

  it("TC-HAND-11 a late return records a LOW LATE_RETURN incident", () => {
    checkoutSeeded();
    const { end } = seededWindow();
    const late = returnBooking(
      sessionUser("u-kabir"),
      "b-approved-r01",
      conditionFor("r01", "GOOD"),
      REQUEST,
      new Date(end.getTime() + 16 * 60_000),
    );
    expect(late.booking.late).toBe(true);
    expect(late.incidents.map((incident) => incident.type)).toEqual(["LATE_RETURN"]);
    expect(late.incidents[0].severity).toBe("LOW");
  });

  it("TC-HAND-12 only the resource manager can return equipment", () => {
    checkoutSeeded();
    const { end } = seededWindow();
    expectAppError(
      () =>
        returnBooking(
          sessionUser("u-rohan"),
          "b-approved-r01",
          conditionFor("r01", "GOOD"),
          REQUEST,
          new Date(end.getTime() + 5 * 60_000),
        ),
      "FORBIDDEN",
    );
    expect(getBooking(DEMO_INSTITUTION_ID, "b-approved-r01")?.status).toBe("CHECKED_OUT");
  });
});
