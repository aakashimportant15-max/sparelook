import { expect } from "vitest";
import { getUserById } from "../../src/server/auth";
import { getResourceById } from "../../src/server/repos/resources";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { zonedParts, zonedTimeToUtc } from "../../src/lib/time";
import type { Resource, SessionUser } from "../../src/domain/types";
import { isAppError, type AppError } from "../../src/lib/errors";

export const TZ = "Asia/Kolkata";
export const DEMO_PASSWORD = "TestPass123!";

export function sessionUser(id: string): SessionUser {
  const user = getUserById(id);
  if (!user) throw new Error(`Missing seed user ${id}`);
  return user;
}

export function seedResource(id: string): Resource {
  const resource = getResourceById(DEMO_INSTITUTION_ID, id);
  if (!resource) throw new Error(`Missing seed resource ${id}`);
  return resource;
}

/** Wall-clock time in the institution zone, offset by whole days from `base`. */
export function localTime(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  const p = zonedParts(base, TZ);
  return zonedTimeToUtc(p.year, p.month, p.day + dayOffset, hour, minute, TZ);
}

export function expectAppError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    if (!isAppError(error)) throw error;
    expect(error.code).toBe(code);
    return;
  }
  throw new Error(`Expected AppError ${code} but nothing was thrown`);
}

export function appError(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (isAppError(error)) return error;
    throw error;
  }
  throw new Error("Expected an AppError but nothing was thrown");
}
