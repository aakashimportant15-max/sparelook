import { describe, expect, it } from "vitest";
import {
  checkEligibility,
  humanizeTag,
  type EligibilityInput,
} from "../../src/domain/eligibility";

const base: EligibilityInput = {
  userStatus: "ACTIVE",
  isOwnResource: false,
  resourceStatus: "ACTIVE",
  allowedGroups: ["media-club"],
  userGroups: ["media-club"],
  requiredTrainings: ["camera-safety"],
  userTrainings: ["camera-safety"],
  openBookings: 0,
  weeklyHours: 0,
  requestedHours: 2,
  waitlistEntries: 0,
  requestingWaitlist: false,
};

function reasons(overrides: Partial<EligibilityInput> = {}) {
  const result = checkEligibility({ ...base, ...overrides });
  return { ...result, codes: result.reasons.map((reason) => reason.code) };
}

describe("TC-ELIG: eligibility rules", () => {
  it("TC-ELIG-01 accepts an active member with the right group and training", () => {
    const result = reasons();
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("TC-ELIG-02 blocks suspended accounts and resources that are not active", () => {
    expect(reasons({ userStatus: "SUSPENDED" }).codes).toContain("USER_SUSPENDED");
    expect(reasons({ resourceStatus: "MAINTENANCE" }).codes).toContain(
      "RESOURCE_UNAVAILABLE",
    );
    expect(reasons({ resourceStatus: "DISABLED" }).codes).toContain(
      "RESOURCE_UNAVAILABLE",
    );
    expect(reasons({ resourceStatus: "ARCHIVED" }).codes).toContain(
      "RESOURCE_UNAVAILABLE",
    );
  });

  it("TC-ELIG-03 blocks owners from requesting their own resource", () => {
    const result = reasons({ isOwnResource: true });
    expect(result.eligible).toBe(false);
    expect(result.codes).toContain("SELF_BOOKING");
  });

  it("TC-ELIG-04 enforces allowed groups and required trainings", () => {
    expect(reasons({ userGroups: ["film-dept"] }).codes).toContain("MISSING_GROUP");
    expect(reasons({ userTrainings: [] }).codes).toContain("MISSING_TRAINING");
    const open = reasons({ allowedGroups: [], requiredTrainings: [] });
    expect(open.eligible).toBe(true);
  });

  it("TC-ELIG-05 limits open bookings, waitlist entries and weekly hours", () => {
    expect(reasons({ openBookings: 3 }).codes).toContain("LIMIT_OPEN_BOOKINGS");
    expect(reasons({ requestingWaitlist: true, waitlistEntries: 2 }).codes).toContain(
      "LIMIT_WAITLIST",
    );
    expect(reasons({ weeklyHours: 23, requestedHours: 2 }).codes).toContain(
      "LIMIT_WEEKLY_HOURS",
    );
    // Waitlist requests replace the open-booking limit with the waitlist limit.
    const waitlist = reasons({
      requestingWaitlist: true,
      openBookings: 5,
      waitlistEntries: 1,
    });
    expect(waitlist.codes).not.toContain("LIMIT_OPEN_BOOKINGS");
    expect(waitlist.eligible).toBe(true);
  });

  it("TC-ELIG-06 returns human-readable messages and humanises tags", () => {
    const result = reasons({ userTrainings: [], userGroups: [] });
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    expect(result.reasons.every((reason) => reason.message.length > 10)).toBe(true);
    expect(humanizeTag("media-club")).toBe("Media club");
    expect(humanizeTag("drone_safety")).toBe("Drone safety");
  });
});
