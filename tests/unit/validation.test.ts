import { describe, expect, it } from "vitest";
import { validateBookingRequest } from "../../src/domain/validation";
import { zonedTimeToUtc } from "../../src/lib/time";

const TZ = "Asia/Kolkata";
const NOW = zonedTimeToUtc(2026, 10, 30, 9, 30, TZ);

function validate(overrides: Partial<Parameters<typeof validateBookingRequest>[0]> = {}) {
  return validateBookingRequest({
    startRaw: "2026-10-31T10:00",
    endRaw: "2026-10-31T12:00",
    purpose: "Club shoot",
    maxDurationHours: 48,
    openTime: "08:00",
    closeTime: "20:00",
    timeZone: TZ,
    now: NOW,
    ...overrides,
  });
}

function codes(result: ReturnType<typeof validate>) {
  return result.errors.map((error) => error.code);
}

describe("TC-VALID: booking request validation", () => {
  it("TC-VALID-01 accepts a valid request", () => {
    const result = validate();
    expect(result.errors).toEqual([]);
    expect(result.start?.toISOString()).toBe("2026-10-31T04:30:00.000Z");
    expect(result.end?.toISOString()).toBe("2026-10-31T06:30:00.000Z");
  });

  it("TC-VALID-02 rejects a missing or malformed datetime", () => {
    expect(codes(validate({ startRaw: "" }))).toContain("INVALID_DATETIME");
    expect(codes(validate({ endRaw: "not-a-date" }))).toContain("INVALID_DATETIME");
  });

  it("TC-VALID-03 rejects an end at or before the start", () => {
    expect(codes(validate({ endRaw: "2026-10-31T10:00" }))).toContain("END_BEFORE_START");
    expect(codes(validate({ endRaw: "2026-10-31T09:00" }))).toContain("END_BEFORE_START");
  });

  it("TC-VALID-04 rejects durations below 60 minutes and above the resource maximum", () => {
    expect(codes(validate({ endRaw: "2026-10-31T10:45" }))).toContain("TOO_SHORT");
    expect(
      codes(
        validate({
          startRaw: "2026-10-31T10:00",
          endRaw: "2026-11-03T12:00",
          openTime: null,
          closeTime: null,
          maxDurationHours: 48,
        }),
      ),
    ).toContain("TOO_LONG");
  });

  it("TC-VALID-05 rejects a start in the past or beyond 30 days", () => {
    expect(
      codes(validate({ startRaw: "2026-10-29T10:00", endRaw: "2026-10-29T12:00" })),
    ).toContain("START_IN_PAST");
    expect(
      codes(validate({ startRaw: "2026-12-15T10:00", endRaw: "2026-12-15T12:00" })),
    ).toContain("TOO_FAR_AHEAD");
  });

  it("TC-VALID-06 rejects times that are not on a 15-minute boundary", () => {
    expect(
      codes(validate({ startRaw: "2026-10-31T10:10", endRaw: "2026-10-31T12:10" })),
    ).toContain("BAD_GRANULARITY");
    expect(
      codes(validate({ startRaw: "2026-10-31T10:00", endRaw: "2026-10-31T12:05" })),
    ).toContain("BAD_GRANULARITY");
  });

  it("TC-VALID-07 rejects bookings outside opening hours or spanning days", () => {
    expect(
      codes(validate({ startRaw: "2026-10-31T07:00", endRaw: "2026-10-31T09:00" })),
    ).toContain("OUTSIDE_OPEN_HOURS");
    expect(
      codes(validate({ startRaw: "2026-10-31T18:00", endRaw: "2026-10-31T21:00" })),
    ).toContain("OUTSIDE_OPEN_HOURS");
    expect(
      codes(
        validate({
          startRaw: "2026-10-31T19:00",
          endRaw: "2026-11-01T11:00",
          maxDurationHours: 48,
        }),
      ),
    ).toContain("OUTSIDE_OPEN_HOURS");
  });

  it("TC-VALID-08 enforces purpose length", () => {
    expect(codes(validate({ purpose: "ab" }))).toContain("PURPOSE_TOO_SHORT");
    expect(codes(validate({ purpose: "x".repeat(301) }))).toContain("PURPOSE_TOO_LONG");
  });

  it("TC-VALID-09 reports multiple problems at once", () => {
    const result = validate({
      startRaw: "2026-10-29T07:10",
      endRaw: "2026-10-29T07:10",
      purpose: "",
    });
    const all = codes(result);
    expect(all).toEqual(
      expect.arrayContaining([
        "START_IN_PAST",
        "BAD_GRANULARITY",
        "END_BEFORE_START",
        "PURPOSE_TOO_SHORT",
      ]),
    );
    expect(result.errors.every((error) => error.field && error.message)).toBe(true);
  });
});
