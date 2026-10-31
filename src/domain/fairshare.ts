import { POLICY } from "./policy";
import type { FairShareSnapshot } from "./types";

export type FairShareCandidate = {
  bookingId: string;
  requesterId: string;
  createdAt: string;
  usageHours30d: number;
};

export type RankedCandidate = FairShareCandidate & { rank: number };

/**
 * Deterministic rule-based ranking (Section 7 R2).
 * 1) lower 30-day usage hours first
 * 2) earlier request first
 * 3) booking id ascending (stable tie-breaker)
 * Pure: no DB access, same input always yields the same order.
 */
export function rankCandidates(candidates: FairShareCandidate[]): RankedCandidate[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.usageHours30d !== b.usageHours30d) return a.usageHours30d - b.usageHours30d;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    if (a.bookingId === b.bookingId) return 0;
    return a.bookingId < b.bookingId ? -1 : 1;
  });
  return sorted.map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

export function buildSnapshot(
  ranked: RankedCandidate,
  competingCount: number,
): FairShareSnapshot {
  return {
    rank: ranked.rank,
    competingCount,
    usageHours30d: Number(ranked.usageHours30d.toFixed(2)),
    createdAt: ranked.createdAt,
    rule: "R2",
    version: POLICY.fairShareVersion,
  };
}

export function explainRank(snapshot: {
  rank: number;
  competingCount: number;
  usageHours30d: number;
}): string {
  const usage = snapshot.usageHours30d.toFixed(1);
  if (snapshot.competingCount === 1) {
    return "You are the only request for this time slot. Ranking favours members with fewer borrowed hours in the last 30 days, then earlier requests.";
  }
  return `You are ranked #${snapshot.rank} of ${snapshot.competingCount} for this time slot. Ranking favours members with fewer borrowed hours in the last 30 days (yours: ${usage} h), then earlier requests.`;
}

export function overrideRequired(rank: number): boolean {
  return rank > 1;
}

/**
 * Explains a live waitlist position using the same R2 rule that promotion uses.
 * The rank is computed among waitlisted requests that overlap the same window;
 * eligibility is re-checked by the server before any promotion.
 */
export function explainWaitlistPosition(rank: number, total: number): string {
  if (total <= 1) {
    return "You are the only waitlisted request for this time slot. Ranking favours members with fewer borrowed hours in the last 30 days, then earlier requests, and eligibility is re-checked before promotion.";
  }
  return `You are #${rank} of ${total} waitlisted requests for this time slot. Ranking favours members with fewer borrowed hours in the last 30 days, then earlier requests, and eligibility is re-checked before promotion.`;
}
