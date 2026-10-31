import type {
  BookingStatus,
  IncidentSeverity,
  IncidentStatus,
  ResourceStatus,
} from "@/domain/types";

type Tone = "green" | "amber" | "red" | "blue" | "teal" | "gray";

const BOOKING: Record<BookingStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "amber" },
  APPROVED: { label: "Approved", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  WAITLISTED: { label: "Waitlisted", tone: "blue" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
  EXPIRED: { label: "Expired", tone: "gray" },
  CHECKED_OUT: { label: "Checked out", tone: "teal" },
  RETURNED: { label: "Returned", tone: "gray" },
};

const RESOURCE: Record<ResourceStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Available", tone: "green" },
  MAINTENANCE: { label: "Maintenance", tone: "amber" },
  DISABLED: { label: "Disabled", tone: "red" },
  ARCHIVED: { label: "Archived", tone: "gray" },
};

const INCIDENT: Record<IncidentStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "red" },
  INVESTIGATING: { label: "Investigating", tone: "amber" },
  RESOLVED: { label: "Resolved", tone: "green" },
  DISMISSED: { label: "Dismissed", tone: "gray" },
};

const SEVERITY: Record<IncidentSeverity, { label: string; tone: Tone }> = {
  LOW: { label: "Low", tone: "gray" },
  MEDIUM: { label: "Medium", tone: "amber" },
  HIGH: { label: "High", tone: "red" },
};

export function Badge({
  tone = "gray",
  children,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge-${tone}${dot ? " badge-dot" : ""}`}>{children}</span>
  );
}

export function BookingBadge({ status }: { status: BookingStatus }) {
  const meta = BOOKING[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function ResourceBadge({ status }: { status: ResourceStatus }) {
  const meta = RESOURCE[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function IncidentBadge({ status }: { status: IncidentStatus }) {
  const meta = INCIDENT[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const meta = SEVERITY[severity];
  return <Badge tone={meta.tone}>{meta.label} severity</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const tone: Tone = role === "ADMIN" ? "teal" : role === "OWNER" ? "blue" : "gray";
  return <Badge tone={tone}>{role.toLowerCase()}</Badge>;
}

export function ConditionBadge({ condition }: { condition: string }) {
  const tone: Tone =
    condition === "GOOD" ? "green" : condition === "MINOR_WEAR" ? "amber" : "red";
  return <Badge tone={tone}>{condition.replace("_", " ").toLowerCase()}</Badge>;
}
