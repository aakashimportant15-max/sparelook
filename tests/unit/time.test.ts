import { describe, expect, it } from "vitest";
import {
  addDays,
  addMinutes,
  durationHours,
  isQuarterHour,
  localDateKey,
  localWeekRange,
  minutesSinceMidnight,
  overlaps,
  parseBookingTime,
  toLocalInputValue,
  zonedParts,
  zonedTimeToUtc,
} from "../../src/lib/time";

const TZ = "Asia/Kolkata";

describe("TC-TIME: time and timezone helpers", () => {
  it("TC-TIME-01 parses a bare local datetime in the institution zone", () => {
    const parsed = parseBookingTime("2026-11-02T10:00", TZ);
    expect(parsed?.toISOString()).toBe("2026-11-02T04:30:00.000Z");
  });

  it("TC-TIME-02 respects an explicit UTC offset", () => {
    const parsed = parseBookingTime("2026-11-02T10:00:00+05:30", TZ);
    expect(parsed?.toISOString()).toBe("2026-11-02T04:30:00.000Z");
    const utc = parseBookingTime("2026-11-02T10:00:00Z", TZ);
    expect(utc?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
  });

  it("TC-TIME-03 rejects malformed datetimes", () => {
    expect(parseBookingTime("", TZ)).toBeNull();
    expect(parseBookingTime("tomorrow morning", TZ)).toBeNull();
    expect(parseBookingTime("2026-13-45T99:99", TZ)).toBeNull();
  });

  it("TC-TIME-04 converts wall-clock time to UTC and back", () => {
    const instant = zonedTimeToUtc(2026, 11, 2, 10, 15, TZ);
    expect(instant.toISOString()).toBe("2026-11-02T04:45:00.000Z");
    const parts = zonedParts(instant, TZ);
    expect(parts).toMatchObject({ year: 2026, month: 11, day: 2, hour: 10, minute: 15 });
    expect(toLocalInputValue(instant, TZ)).toBe("2026-11-02T10:15");
    expect(localDateKey(instant, TZ)).toBe("2026-11-02");
    expect(minutesSinceMidnight(instant, TZ)).toBe(615);
  });

  it("TC-TIME-05 detects quarter-hour boundaries", () => {
    const onBoundary = zonedTimeToUtc(2026, 11, 2, 10, 45, TZ);
    const offBoundary = zonedTimeToUtc(2026, 11, 2, 10, 47, TZ);
    expect(isQuarterHour(onBoundary, TZ)).toBe(true);
    expect(isQuarterHour(offBoundary, TZ)).toBe(false);
  });

  it("TC-TIME-06 treats overlap as half-open (touching windows do not overlap)", () => {
    const aStart = new Date("2026-11-02T10:00:00Z");
    const aEnd = new Date("2026-11-02T12:00:00Z");
    expect(
      overlaps(
        aStart,
        aEnd,
        new Date("2026-11-02T11:00:00Z"),
        new Date("2026-11-02T13:00:00Z"),
      ),
    ).toBe(true);
    expect(
      overlaps(
        aStart,
        aEnd,
        new Date("2026-11-02T12:00:00Z"),
        new Date("2026-11-02T14:00:00Z"),
      ),
    ).toBe(false);
    expect(
      overlaps(
        aStart,
        aEnd,
        new Date("2026-11-02T08:00:00Z"),
        new Date("2026-11-02T10:00:00Z"),
      ),
    ).toBe(false);
    expect(
      overlaps(
        aStart,
        aEnd,
        new Date("2026-11-02T10:30:00Z"),
        new Date("2026-11-02T11:30:00Z"),
      ),
    ).toBe(true);
  });

  it("TC-TIME-07 computes the local Monday-to-Monday week in the institution zone", () => {
    // Friday 30 Oct 2026, 12:00 IST.
    const fridayNoon = zonedTimeToUtc(2026, 10, 30, 12, 0, TZ);
    const week = localWeekRange(fridayNoon, TZ);
    expect(toLocalInputValue(week.start, TZ)).toBe("2026-10-26T00:00");
    expect(toLocalInputValue(week.end, TZ)).toBe("2026-11-02T00:00");
  });

  it("TC-TIME-08 adds minutes/days and measures durations", () => {
    const start = new Date("2026-11-02T10:00:00Z");
    expect(addMinutes(start, 90).toISOString()).toBe("2026-11-02T11:30:00.000Z");
    expect(addDays(start, 2).toISOString()).toBe("2026-11-04T10:00:00.000Z");
    expect(durationHours(start, addMinutes(start, 135))).toBe(2.25);
  });
});
