export const FALLBACK_TIMEZONE = "Asia/Kolkata";

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
};

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const map: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  return {
    year,
    month,
    day,
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** Offset of the zone at that instant, in milliseconds (east positive). */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC instant. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = zoneOffsetMs(new Date(guess), timeZone);
  let utc = guess - firstOffset;
  const secondOffset = zoneOffsetMs(new Date(utc), timeZone);
  if (secondOffset !== firstOffset) utc = guess - secondOffset;
  return new Date(utc);
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;
const OFFSET_INPUT = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parse a booking time. Explicit offsets are respected; a bare local
 * date-time is interpreted in the institution time zone (BR-01).
 * Returns null for invalid or ambiguous input.
 */
export function parseBookingTime(value: string, timeZone: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (OFFSET_INPUT.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = LOCAL_INPUT.exec(trimmed);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = s ? Number(s) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59)
    return null;
  const date = zonedTimeToUtc(year, month, day, hour, minute, timeZone);
  const check = zonedParts(date, timeZone);
  if (
    check.year !== year ||
    check.month !== month ||
    check.day !== day ||
    check.hour !== hour ||
    check.minute !== minute ||
    check.second !== second
  ) {
    return null;
  }
  return date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalInputValue(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatDateTime(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDate(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatTime(instant: Date | string, timeZone: string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatRange(startIso: string, endIso: string, timeZone: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const startDate = formatDate(start, timeZone);
  const endDate = formatDate(end, timeZone);
  if (startDate === endDate) {
    return `${startDate}, ${formatTime(start, timeZone)}–${formatTime(end, timeZone)}`;
  }
  return `${formatDateTime(start, timeZone)} → ${formatDateTime(end, timeZone)}`;
}

export function isQuarterHour(instant: Date, timeZone: string): boolean {
  const p = zonedParts(instant, timeZone);
  return p.minute % 15 === 0 && p.second === 0;
}

export function minutesSinceMidnight(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  return p.hour * 60 + p.minute;
}

export function localDateKey(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

export function addDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * 86_400_000);
}

export function durationHours(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

/** Monday 00:00 to next Monday 00:00 in the institution zone, as UTC instants. */
export function localWeekRange(
  instant: Date,
  timeZone: string,
): { start: Date; end: Date } {
  const p = zonedParts(instant, timeZone);
  const daysSinceMonday = (p.weekday + 6) % 7;
  const mondayUtc = new Date(Date.UTC(p.year, p.month - 1, p.day - daysSinceMonday));
  const nextMondayUtc = new Date(
    Date.UTC(p.year, p.month - 1, p.day - daysSinceMonday + 7),
  );
  const mp = {
    y: mondayUtc.getUTCFullYear(),
    m: mondayUtc.getUTCMonth() + 1,
    d: mondayUtc.getUTCDate(),
  };
  const np = {
    y: nextMondayUtc.getUTCFullYear(),
    m: nextMondayUtc.getUTCMonth() + 1,
    d: nextMondayUtc.getUTCDate(),
  };
  return {
    start: zonedTimeToUtc(mp.y, mp.m, mp.d, 0, 0, timeZone),
    end: zonedTimeToUtc(np.y, np.m, np.d, 0, 0, timeZone),
  };
}

export function zoneLabel(timeZone: string): string {
  return timeZone.replace("_", " ");
}
