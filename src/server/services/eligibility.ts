import { checkEligibility, type EligibilityResult } from "../../domain/eligibility";
import { POLICY } from "../../domain/policy";
import type { Resource, SessionUser } from "../../domain/types";
import { localWeekRange } from "../../lib/time";
import { openBookingCount, sumHours, waitlistCount } from "../repos/bookings";

export type EligibilityOptions = {
  requestedHours?: number;
  requestingWaitlist?: boolean;
  excludeBookingId?: string;
  now?: Date;
};

export function evaluateEligibility(
  user: SessionUser,
  resource: Resource,
  options: EligibilityOptions = {},
): EligibilityResult {
  const now = options.now ?? new Date();
  const week = localWeekRange(now, user.timezone);
  const weeklyHours = sumHours(
    user.id,
    POLICY.weeklyHoursStatuses,
    week.start.toISOString(),
    week.end.toISOString(),
    options.excludeBookingId,
  );
  return checkEligibility({
    userStatus: user.status,
    isOwnResource: resource.ownerId === user.id,
    resourceStatus: resource.status,
    allowedGroups: resource.allowedGroups,
    userGroups: user.groups,
    requiredTrainings: resource.requiredTrainings,
    userTrainings: user.trainings,
    openBookings: openBookingCount(user.id, options.excludeBookingId),
    weeklyHours,
    requestedHours: options.requestedHours ?? 0,
    waitlistEntries: waitlistCount(user.id, options.excludeBookingId),
    requestingWaitlist: options.requestingWaitlist ?? false,
  });
}

export function eligibilitySummary(result: EligibilityResult): string {
  if (result.eligible) return "Eligible";
  return result.reasons[0]?.message ?? "Not eligible";
}
