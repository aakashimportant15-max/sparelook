import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  explainRank,
  explainWaitlistPosition,
  overrideRequired,
  rankCandidates,
} from "../../src/domain/fairshare";

const candidates = [
  {
    bookingId: "b-3",
    requesterId: "u-3",
    createdAt: "2026-10-30T08:00:00.000Z",
    usageHours30d: 12,
  },
  {
    bookingId: "b-1",
    requesterId: "u-1",
    createdAt: "2026-10-30T09:00:00.000Z",
    usageHours30d: 0,
  },
  {
    bookingId: "b-2",
    requesterId: "u-2",
    createdAt: "2026-10-30T08:00:00.000Z",
    usageHours30d: 0,
  },
];

describe("TC-FS: FairShare ranking", () => {
  it("TC-FS-01 ranks lower 30-day usage first, then earlier request", () => {
    const ranked = rankCandidates(candidates);
    expect(ranked.map((c) => c.bookingId)).toEqual(["b-2", "b-1", "b-3"]);
  });

  it("TC-FS-02 breaks full ties by booking id ascending", () => {
    const ranked = rankCandidates([
      {
        bookingId: "b-z",
        requesterId: "u",
        createdAt: "2026-10-30T08:00:00.000Z",
        usageHours30d: 2,
      },
      {
        bookingId: "b-a",
        requesterId: "u",
        createdAt: "2026-10-30T08:00:00.000Z",
        usageHours30d: 2,
      },
    ]);
    expect(ranked.map((c) => c.bookingId)).toEqual(["b-a", "b-z"]);
  });

  it("TC-FS-03 assigns contiguous 1-based ranks and does not mutate input", () => {
    const input = [...candidates];
    const ranked = rankCandidates(input);
    expect(ranked.map((c) => c.rank)).toEqual([1, 2, 3]);
    expect(input).toEqual(candidates);
  });

  it("TC-FS-04 is deterministic across repeated calls", () => {
    expect(rankCandidates(candidates)).toEqual(rankCandidates(candidates));
  });

  it("TC-FS-05 snapshots the rank, competitor count and rounded usage", () => {
    const [first] = rankCandidates([
      {
        bookingId: "b-1",
        requesterId: "u",
        createdAt: "2026-10-30T08:00:00.000Z",
        usageHours30d: 7.456,
      },
      {
        bookingId: "b-2",
        requesterId: "u",
        createdAt: "2026-10-30T09:00:00.000Z",
        usageHours30d: 9,
      },
    ]);
    const snapshot = buildSnapshot(first, 2);
    expect(snapshot).toMatchObject({
      rank: 1,
      competingCount: 2,
      usageHours30d: 7.46,
      rule: "R2",
      version: "fairshare-v1",
    });
  });

  it("TC-FS-06 explains a sole request and a contested slot", () => {
    expect(explainRank({ rank: 1, competingCount: 1, usageHours30d: 0 })).toContain(
      "only request",
    );
    const contested = explainRank({ rank: 2, competingCount: 3, usageHours30d: 12.5 });
    expect(contested).toContain("#2 of 3");
    expect(contested).toContain("12.5 h");
  });

  it("TC-FS-07 requires an override for any rank above first", () => {
    expect(overrideRequired(1)).toBe(false);
    expect(overrideRequired(2)).toBe(true);
    expect(overrideRequired(5)).toBe(true);
  });

  it("TC-FS-08 explains a waitlist position with the real R2 rule", () => {
    expect(explainWaitlistPosition(1, 1)).toContain("only waitlisted request");
    const contested = explainWaitlistPosition(2, 3);
    expect(contested).toContain("#2 of 3 waitlisted requests");
    expect(contested).toContain("fewer borrowed hours");
    expect(contested).toContain("earlier requests");
    expect(contested).toContain("eligibility is re-checked");
  });
});
