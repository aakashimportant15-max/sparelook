import { POLICY } from "./policy";
import type { ResourceStatus, UserStatus } from "./types";

export type EligibilityReason = { code: string; message: string };

export type EligibilityInput = {
  userStatus: UserStatus;
  isOwnResource: boolean;
  resourceStatus: ResourceStatus;
  allowedGroups: string[];
  userGroups: string[];
  requiredTrainings: string[];
  userTrainings: string[];
  openBookings: number;
  weeklyHours: number;
  requestedHours: number;
  waitlistEntries: number;
  requestingWaitlist: boolean;
};

export type EligibilityResult = { eligible: boolean; reasons: EligibilityReason[] };

export function humanizeTag(tag: string): string {
  const words = tag.replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Pure eligibility evaluation (US-03). Used by the UI hint and by the server
 * booking/approval checks so they cannot diverge.
 */
export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: EligibilityReason[] = [];

  if (input.userStatus === "SUSPENDED") {
    reasons.push({
      code: "USER_SUSPENDED",
      message: "Your account is suspended. Contact an institution administrator.",
    });
  }

  if (input.resourceStatus === "MAINTENANCE") {
    reasons.push({
      code: "RESOURCE_UNAVAILABLE",
      message: "This resource is under maintenance and cannot be requested.",
    });
  } else if (input.resourceStatus !== "ACTIVE") {
    reasons.push({
      code: "RESOURCE_UNAVAILABLE",
      message: "This resource is not available for booking.",
    });
  }

  if (input.isOwnResource) {
    reasons.push({
      code: "SELF_BOOKING",
      message:
        "You cannot request your own resource. Another owner or an administrator must handle this booking.",
    });
  }

  if (
    input.allowedGroups.length > 0 &&
    !input.allowedGroups.some((group) => input.userGroups.includes(group))
  ) {
    reasons.push({
      code: "MISSING_GROUP",
      message: `This resource is limited to members of: ${input.allowedGroups
        .map(humanizeTag)
        .join(", ")}.`,
    });
  }

  for (const training of input.requiredTrainings) {
    if (!input.userTrainings.includes(training)) {
      reasons.push({
        code: "MISSING_TRAINING",
        message: `${humanizeTag(training)} training is required for this resource.`,
      });
    }
  }

  if (input.requestingWaitlist) {
    if (input.waitlistEntries >= POLICY.maxWaitlistEntries) {
      reasons.push({
        code: "LIMIT_WAITLIST",
        message: `You already have ${input.waitlistEntries} waitlist entries (limit ${POLICY.maxWaitlistEntries}). Remove one before joining another waitlist.`,
      });
    }
  } else if (input.openBookings >= POLICY.maxOpenBookings) {
    reasons.push({
      code: "LIMIT_OPEN_BOOKINGS",
      message: `You already have ${input.openBookings} open bookings (limit ${POLICY.maxOpenBookings}). Complete or cancel one before requesting again.`,
    });
  }

  const projectedHours = input.weeklyHours + input.requestedHours;
  if (projectedHours > POLICY.maxWeeklyHours) {
    reasons.push({
      code: "LIMIT_WEEKLY_HOURS",
      message: `This request would bring you to ${projectedHours.toFixed(
        1,
      )} booked hours this week. The weekly limit is ${POLICY.maxWeeklyHours} hours.`,
    });
  }

  return { eligible: reasons.length === 0, reasons };
}
