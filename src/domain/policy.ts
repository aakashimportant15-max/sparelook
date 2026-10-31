/** Single place for MVP policy defaults (Sections 6-7). All values are assumptions. */
export const POLICY = {
  granularityMinutes: 15,
  minDurationMinutes: 60,
  maxAdvanceDays: 30,
  defaultMaxDurationHours: 72,
  maxOpenBookings: 3,
  maxWaitlistEntries: 2,
  maxWeeklyHours: 24,
  usageWindowDays: 30,
  checkoutWindowBeforeMinutes: 30,
  lateGraceMinutes: 15,
  noShowAfterMinutes: 60,
  overrideReasonMin: 10,
  overrideReasonMax: 300,
  reasonMin: 5,
  reasonMax: 300,
  purposeMin: 3,
  purposeMax: 300,
  notesMax: 1000,
  incidentDescriptionMin: 10,
  incidentDescriptionMax: 2000,
  fairShareVersion: "fairshare-v1" as const,
  openBookingsStatuses: ["PENDING", "APPROVED", "CHECKED_OUT"] as const,
  usageStatuses: ["CHECKED_OUT", "RETURNED"] as const,
  weeklyHoursStatuses: ["PENDING", "APPROVED", "CHECKED_OUT", "RETURNED"] as const,
  blockingStatuses: ["APPROVED", "CHECKED_OUT"] as const,
} as const;

export const CONDITION_ORDER = ["GOOD", "MINOR_WEAR", "DAMAGED", "NOT_WORKING"] as const;

export function conditionSeverity(condition: string): number {
  const index = (CONDITION_ORDER as readonly string[]).indexOf(condition);
  return index === -1 ? 0 : index;
}

export function parseStringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === "string");
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
