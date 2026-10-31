import type { Metadata } from "next";
import Link from "next/link";
import { IncidentBadge, SeverityBadge } from "@/components/Badges";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/time";
import type { IncidentStatus } from "@/domain/types";
import { requirePageUser } from "@/server/page-guards";
import { incidentListForUser } from "@/server/services/incidents";

export const metadata: Metadata = { title: "Incidents" };

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "INVESTIGATING", label: "Investigating" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
];

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requirePageUser("/incidents");
  const params = await searchParams;
  const status = (params.status || undefined) as IncidentStatus | undefined;
  const incidents = incidentListForUser(user, { status });

  return (
    <div className="container">
      <PageHeader
        eyebrow="Safety and condition"
        title="Incidents"
        description="Damage, missing items and late returns. Incidents are visible to the people involved, the resource owner and administrators."
      />

      <form className="filter-bar" method="get">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            className="select"
            defaultValue={status ?? ""}
          >
            {STATUSES.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      {incidents.length === 0 ? (
        <EmptyState title="No incidents to show">
          Incidents are created automatically from a return discrepancy, or reported by a
          borrower or owner. Nothing matches this filter.
        </EmptyState>
      ) : (
        <div className="stack">
          {incidents.map((incident) => (
            <article className="card card-pad" key={incident.id}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                    <Link href={`/incidents/${incident.id}`} className="strong">
                      {incident.type.replaceAll("_", " ").toLowerCase()} ·{" "}
                      {incident.resourceName ?? "Resource"}
                    </Link>
                    <IncidentBadge status={incident.status} />
                    <SeverityBadge severity={incident.severity} />
                  </div>
                  <p className="small" style={{ margin: 0, maxWidth: "80ch" }}>
                    {incident.description}
                  </p>
                  <div className="tiny muted" style={{ marginTop: 6 }}>
                    Reported {formatDateTime(incident.createdAt, user.timezone)}
                    {incident.reporterName ? ` by ${incident.reporterName}` : ""}
                    {incident.bookingId ? (
                      <>
                        {" · "}
                        <Link href={`/bookings/${incident.bookingId}`}>
                          linked booking
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                <Link
                  href={`/incidents/${incident.id}`}
                  className="btn btn-secondary btn-sm"
                >
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
