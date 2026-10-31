import type { FieldError } from "../lib/errors";
import { POLICY } from "./policy";
import {
  durationHours,
  isQuarterHour,
  localDateKey,
  minutesSinceMidnight,
  parseBookingTime,
  zonedParts,
} from "../lib/time";

export type BookingValidationInput = {
  startRaw: string;
  endRaw: string;
  purpose: string;
  maxDurationHours: number;
  openTime?: string | null;
  closeTime?: string | null;
  timeZone: string;
  now: Date;
};

export type BookingValidationResult = {
  start: Date | null;
  end: Date | null;
  errors: FieldError[];
};

function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function validateBookingRequest(
  input: BookingValidationInput,
): BookingValidationResult {
  const errorsList: FieldError[] = [];
  const start = parseBookingTime(input.startRaw, input.timeZone);
  const end = parseBookingTime(input.endRaw, input.timeZone);

  if (!start) {
    errorsList.push({
      field: "startAt",
      code: "INVALID_DATETIME",
      message: "Enter a valid start date and time.",
    });
  }
  if (!end) {
    errorsList.push({
      field: "endAt",
      code: "INVALID_DATETIME",
      message: "Enter a valid end date and time.",
    });
  }

  const purpose = input.purpose.trim();
  if (purpose.length < POLICY.purposeMin) {
    errorsList.push({
      field: "purpose",
      code: "PURPOSE_TOO_SHORT",
      message: `Describe the purpose in at least ${POLICY.purposeMin} characters.`,
    });
  } else if (purpose.length > POLICY.purposeMax) {
    errorsList.push({
      field: "purpose",
      code: "PURPOSE_TOO_LONG",
      message: `Keep the purpose under ${POLICY.purposeMax} characters.`,
    });
  }

  if (start && end) {
    if (end.getTime() <= start.getTime()) {
      errorsList.push({
        field: "endAt",
        code: "END_BEFORE_START",
        message: "End time must be after the start time.",
      });
    } else {
      const hours = durationHours(start, end);
      if (hours * 60 < POLICY.minDurationMinutes) {
        errorsList.push({
          field: "endAt",
          code: "TOO_SHORT",
          message: `Bookings must be at least ${POLICY.minDurationMinutes} minutes long.`,
        });
      }
      if (hours > input.maxDurationHours) {
        errorsList.push({
          field: "endAt",
          code: "TOO_LONG",
          message: `This resource can be booked for at most ${input.maxDurationHours} hours.`,
        });
      }
    }

    if (start.getTime() < input.now.getTime()) {
      errorsList.push({
        field: "startAt",
        code: "START_IN_PAST",
        message: "Start time must be in the future.",
      });
    }

    const maxAdvance = input.now.getTime() + POLICY.maxAdvanceDays * 86_400_000;
    if (start.getTime() > maxAdvance) {
      errorsList.push({
        field: "startAt",
        code: "TOO_FAR_AHEAD",
        message: `Bookings can be requested at most ${POLICY.maxAdvanceDays} days ahead.`,
      });
    }

    if (!isQuarterHour(start, input.timeZone)) {
      errorsList.push({
        field: "startAt",
        code: "BAD_GRANULARITY",
        message: `Start time must be on a ${POLICY.granularityMinutes}-minute boundary.`,
      });
    }
    if (!isQuarterHour(end, input.timeZone)) {
      errorsList.push({
        field: "endAt",
        code: "BAD_GRANULARITY",
        message: `End time must be on a ${POLICY.granularityMinutes}-minute boundary.`,
      });
    }

    const open = input.openTime ? parseClock(input.openTime) : null;
    const close = input.closeTime ? parseClock(input.closeTime) : null;
    if (open !== null && close !== null) {
      const startMinutes = minutesSinceMidnight(start, input.timeZone);
      const endMinutes = minutesSinceMidnight(end, input.timeZone);
      const sameDay =
        localDateKey(start, input.timeZone) === localDateKey(end, input.timeZone);
      if (!sameDay || startMinutes < open || endMinutes > close) {
        errorsList.push({
          field: "startAt",
          code: "OUTSIDE_OPEN_HOURS",
          message: `This resource can be booked between ${input.openTime} and ${input.closeTime} (${input.timeZone}).`,
        });
      }
    }
  }

  return { start, end, errors: errorsList };
}

export function nextLocalQuarterHour(now: Date, timeZone: string): Date {
  const p = zonedParts(now, timeZone);
  const minutes = Math.ceil((p.minute + p.second / 60) / 15) * 15;
  const overflowHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const base = new Date(
    Date.UTC(p.year, p.month - 1, p.day, p.hour + overflowHours, remainder),
  );
  const offsetGuess = Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    base.getUTCHours(),
    base.getUTCMinutes(),
  );
  // Reuse the zone-aware constructor through parse of a local string.
  const local = `${String(base.getUTCFullYear()).padStart(4, "0")}-${String(
    base.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}T${String(
    base.getUTCHours(),
  ).padStart(2, "0")}:${String(base.getUTCMinutes()).padStart(2, "0")}`;
  const parsed = parseBookingTime(local, timeZone);
  return parsed ?? new Date(offsetGuess);
}
