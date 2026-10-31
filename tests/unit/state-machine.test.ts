import { describe, expect, it } from "vitest";
import {
  TRANSITIONS,
  assertTransition,
  canTransition,
  isBlocking,
  isOpen,
  isTerminal,
} from "../../src/domain/booking-machine";
import { AppError } from "../../src/lib/errors";
import type { BookingStatus } from "../../src/domain/types";

const ALL: BookingStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WAITLISTED",
  "CANCELLED",
  "EXPIRED",
  "CHECKED_OUT",
  "RETURNED",
];

describe("TC-STATE: booking state machine", () => {
  it("TC-STATE-01 allows the documented forward transitions", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
    expect(canTransition("PENDING", "REJECTED")).toBe(true);
    expect(canTransition("PENDING", "WAITLISTED")).toBe(true);
    expect(canTransition("WAITLISTED", "PENDING")).toBe(true);
    expect(canTransition("WAITLISTED", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "CHECKED_OUT")).toBe(true);
    expect(canTransition("CHECKED_OUT", "RETURNED")).toBe(true);
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("PENDING", "EXPIRED")).toBe(true);
  });

  it("TC-STATE-02 rejects undocumented transitions", () => {
    expect(canTransition("APPROVED", "RETURNED")).toBe(false);
    expect(canTransition("PENDING", "CHECKED_OUT")).toBe(false);
    expect(canTransition("CHECKED_OUT", "CANCELLED")).toBe(false);
    expect(canTransition("RETURNED", "APPROVED")).toBe(false);
    expect(canTransition("REJECTED", "PENDING")).toBe(false);
  });

  it("TC-STATE-03 treats rejection, cancellation, expiry and return as terminal", () => {
    for (const status of [
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
      "RETURNED",
    ] as BookingStatus[]) {
      expect(isTerminal(status)).toBe(true);
      expect(TRANSITIONS[status]).toEqual([]);
    }
    for (const status of [
      "PENDING",
      "APPROVED",
      "CHECKED_OUT",
      "WAITLISTED",
    ] as BookingStatus[]) {
      expect(isTerminal(status)).toBe(false);
    }
  });

  it("TC-STATE-04 classifies open and blocking statuses", () => {
    expect(ALL.filter(isOpen)).toEqual(["PENDING", "APPROVED", "CHECKED_OUT"]);
    expect(ALL.filter(isBlocking)).toEqual(["APPROVED", "CHECKED_OUT"]);
  });

  it("TC-STATE-05 assertTransition throws INVALID_TRANSITION with both states", () => {
    try {
      assertTransition("APPROVED", "RETURNED");
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("INVALID_TRANSITION");
      expect(appError.status).toBe(409);
      expect(appError.message).toContain("APPROVED");
      expect(appError.message).toContain("RETURNED");
    }
  });

  it("TC-STATE-06 allows every listed transition and nothing else", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(TRANSITIONS[from].includes(to));
      }
    }
  });
});
