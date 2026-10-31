export type Role = "BORROWER" | "OWNER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED";
export type ResourceStatus = "ACTIVE" | "MAINTENANCE" | "DISABLED" | "ARCHIVED";
export type BookingStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WAITLISTED"
  | "CANCELLED"
  | "EXPIRED"
  | "CHECKED_OUT"
  | "RETURNED";
export type Condition = "GOOD" | "MINOR_WEAR" | "DAMAGED" | "NOT_WORKING";
export type IncidentType =
  "DAMAGE" | "MISSING_ITEM" | "LATE_RETURN" | "CONDITION_DISPUTE" | "OTHER";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH";
export type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "DISMISSED";

export type SessionUser = {
  id: string;
  institutionId: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  groups: string[];
  trainings: string[];
  timezone: string;
};

export type Resource = {
  id: string;
  institutionId: string;
  ownerId: string;
  ownerName?: string;
  name: string;
  type: string;
  category: string;
  assetTag: string;
  location: string;
  description: string;
  accessories: string[];
  status: ResourceStatus;
  approvalRequired: boolean;
  maxDurationHours: number;
  openTime: string | null;
  closeTime: string | null;
  allowedGroups: string[];
  requiredTrainings: string[];
  createdAt: string;
  updatedAt: string;
};

export type Booking = {
  id: string;
  institutionId: string;
  resourceId: string;
  resourceName?: string;
  requesterId: string;
  requesterName?: string;
  startAt: string;
  endAt: string;
  purpose: string;
  status: BookingStatus;
  decisionReason: string | null;
  decidedBy: string | null;
  idempotencyKey: string;
  late: boolean;
  discrepancy: boolean;
  fairnessSnapshot: FairShareSnapshot | null;
  createdAt: string;
  updatedAt: string;
};

export type FairShareSnapshot = {
  rank: number;
  competingCount: number;
  usageHours30d: number;
  createdAt: string;
  rule: "R2";
  version: "fairshare-v1";
};

export type ConditionReport = {
  id: string;
  bookingId: string;
  type: "CHECKOUT" | "RETURN";
  overallCondition: Condition;
  checklist: Record<string, "PRESENT" | "MISSING">;
  notes: string;
  recordedBy: string;
  recordedByName?: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  disputed: boolean;
  createdAt: string;
};

export type Incident = {
  id: string;
  institutionId: string;
  resourceId: string;
  resourceName?: string;
  bookingId: string | null;
  reporterId: string | null;
  reporterName?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string;
  status: IncidentStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEvent = {
  id: string;
  institutionId: string;
  actorId: string | null;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: "SUCCESS" | "DENIED" | "FAILED";
  metadata: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
};

export type ConditionRanking = { rank: number; condition: Condition };
