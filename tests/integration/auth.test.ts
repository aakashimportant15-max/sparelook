import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getSessionUser,
  hashPassword,
  revokeSession,
  sessionTokenHash,
  signIn,
} from "../../src/server/auth";
import { getDb } from "../../src/db/client";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { DEMO_PASSWORD } from "../helpers/fixtures";
import { rateLimit, resetRateLimitsForTests } from "../../src/server/rate-limit";
import bcrypt from "bcryptjs";

const ANANYA = "ananya@riverbend-demo.example";
const DEV = "dev@riverbend-demo.example";

function signInOk(email: string) {
  const result = signIn(email, DEMO_PASSWORD);
  if (!result.ok) throw new Error(`Expected sign-in to succeed: ${result.reason}`);
  return result;
}

function sessionCount(): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS count FROM sessions").get() as { count: number }
  ).count;
}

describe("TC-AUTH: authentication and sessions", () => {
  beforeEach(() => {
    resetDatabase();
    resetRateLimitsForTests();
  });
  afterAll(() => teardownDatabase());

  it("TC-AUTH-01 signs in with valid credentials and issues a hashed session token", () => {
    const result = signInOk(ANANYA);
    expect(result.user.id).toBe("u-ananya");
    expect(result.user.role).toBe("BORROWER");
    expect(result.token.length).toBeGreaterThan(30);
    const row = getDb()
      .prepare("SELECT token_hash FROM sessions WHERE user_id = ?")
      .get("u-ananya") as { token_hash: string };
    expect(row.token_hash).toBe(sessionTokenHash(result.token));
    expect(row.token_hash).not.toContain(result.token);
  });

  it("TC-AUTH-02 rejects wrong passwords and unknown accounts with the same error", () => {
    expect(signIn(ANANYA, "wrong-password")).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
    expect(signIn("nobody@riverbend-demo.example", DEMO_PASSWORD)).toEqual({
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
    expect(signIn(ANANYA.toLowerCase(), DEMO_PASSWORD).ok).toBe(true);
  });

  it("TC-AUTH-03 refuses to sign in a suspended account", () => {
    getDb().prepare("UPDATE users SET status = 'SUSPENDED' WHERE id = ?").run("u-dev");
    expect(signIn(DEV, DEMO_PASSWORD)).toEqual({ ok: false, reason: "SUSPENDED" });
  });

  it("TC-AUTH-04 resolves a session token and rejects tampered tokens", () => {
    const { token } = signInOk(ANANYA);
    expect(getSessionUser(token)?.id).toBe("u-ananya");
    expect(getSessionUser(`${token}x`)).toBeNull();
    expect(getSessionUser(undefined)).toBeNull();
  });

  it("TC-AUTH-05 revoking a session invalidates the token immediately", () => {
    const { token } = signInOk(ANANYA);
    revokeSession(token);
    expect(getSessionUser(token)).toBeNull();
    expect(sessionCount()).toBe(0);
  });

  it("TC-AUTH-06 expires idle and absolute sessions and deletes the rows", () => {
    const idle = signInOk(ANANYA);
    getDb()
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE user_id = ?")
      .run(new Date(Date.now() - 9 * 3_600_000).toISOString(), "u-ananya");
    expect(getSessionUser(idle.token)).toBeNull();
    expect(sessionCount()).toBe(0);

    const absolute = signInOk(ANANYA);
    getDb()
      .prepare("UPDATE sessions SET expires_at = ? WHERE user_id = ?")
      .run(new Date(Date.now() - 60_000).toISOString(), "u-ananya");
    expect(getSessionUser(absolute.token)).toBeNull();
    expect(sessionCount()).toBe(0);
  });

  it("TC-AUTH-07 logging out via revocation of all sessions clears every token", () => {
    const first = signInOk(ANANYA);
    const second = signInOk(ANANYA);
    expect(sessionCount()).toBe(2);
    getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run("u-ananya");
    expect(getSessionUser(first.token)).toBeNull();
    expect(getSessionUser(second.token)).toBeNull();
  });

  it("TC-AUTH-08 session lookup rejects users suspended after sign-in", () => {
    const { token } = signInOk(ANANYA);
    getDb().prepare("UPDATE users SET status = 'SUSPENDED' WHERE id = ?").run("u-ananya");
    expect(getSessionUser(token)).toBeNull();
    expect(sessionCount()).toBe(0);
  });

  it("TC-AUTH-09 password hashes are bcrypt and verify", () => {
    const hash = hashPassword("AnotherPass1!");
    expect(hash.startsWith("$2")).toBe(true);
    expect(bcrypt.compareSync("AnotherPass1!", hash)).toBe(true);
    expect(bcrypt.compareSync("wrong", hash)).toBe(false);
  });

  it("TC-AUTH-10 in-memory rate limiter blocks attempts past the limit and resets", () => {
    const now = 1_000_000;
    expect(rateLimit("login:1", 3, 60_000, now)).toBe(true);
    expect(rateLimit("login:1", 3, 60_000, now + 1)).toBe(true);
    expect(rateLimit("login:1", 3, 60_000, now + 2)).toBe(true);
    expect(rateLimit("login:1", 3, 60_000, now + 3)).toBe(false);
    expect(rateLimit("login:1", 3, 60_000, now + 60_001)).toBe(true);
    expect(rateLimit("login:2", 3, 60_000, now)).toBe(true);
  });

  it("TC-AUTH-11 demo institution is the only seeded tenant in the default fixture", () => {
    const institutions = getDb()
      .prepare("SELECT id FROM institutions ORDER BY id")
      .all() as { id: string }[];
    expect(institutions).toEqual([{ id: DEMO_INSTITUTION_ID }]);
  });
});
