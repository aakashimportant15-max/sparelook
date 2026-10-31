import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncidentBadge, SeverityBadge } from "@/components/Badges";
import { IncidentStatusForm } from "@/components/IncidentStatusForm";
import { Alert, PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/time";
import { isAppError } from "@/lib/errors";
import { requirePageUser } from "@/server/page-guards";
import { incidentDetail } from "@/server/services/incidents";

export const metadata: Metadata = { title: "Incident" };

const HISTORY_LABELS: Record<string, string> = {
  "incident.created": "Reported",
  "incident.investigating": "Investigation started",
  "incident.resolved": "Resolved",
  "incident.dismissed": "Dismissed",
  "incident.open": "Reopened",
};

function historyLabel(entry: { action: string; from: string | null; to: string | null }) {
  return (
    HISTORY_LABELS[entry.action] ??
    (entry.from && entry.to ? `${entry.from} → ${entry.to}` : entry.action)
  );
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  let detail: ReturnType<typeof incidentDetail>;
  try {
    detail = incidentDetail(user, id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { incident, resource, booking, canManage, canReopen, history } = detail;

  return (
    <div className="container">
      <PageHeader
        eyebrow="Incident record"
        title={`${incident.type.replaceAll("_", " ").toLowerCase()} · ${resource.name}`}
        description={`Reported ${formatDateTime(incident.createdAt, user.timezone)}${
          incident.reporterName ? ` by ${incident.reporterName}` : ""
        }`}
        actions={
          <>
            <IncidentBadge status={incident.status} />
            <SeverityBadge severity={incident.severity} />
            <Link href={`/resources/${resource.id}`} className="btn btn-secondary">
              Resource
            </Link>
          </>
        }
      />

      <div className="split">
        <div className="stack">
          <section className="card card-pad">
            <h2 style={{ fontSize: "1.1rem" }}>Description</h2>
            <p style={{ marginBottom: 0 }}>{incident.description}</p>
          </section>

          <section className="card card-pad">
            <h2 style={{ fontSize: "1.1rem" }}>Resolution</h2>
            {incident.status === "RESOLVED" || incident.status === "DISMISSED" ? (
              <>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <IncidentBadge status={incident.status} />
                  {incident.resolvedAt ? (
                    <span className="small muted">
                      {formatDateTime(incident.resolvedAt, user.timezone)}
                    </span>
                  ) : null}
                </div>
                <p className="small" style={{ margin: 0 }}>
                  {incident.resolutionNote ?? "No note recorded."}
                </p>
              </>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                {incident.status === "OPEN"
                  ? "Next step: the resource owner or an administrator will review this report. No penalty or decision is applied automatically."
                  : "Next step: the owner is investigating. The outcome and any resolution note will appear here once it is recorded."}
              </p>
            )}
          </section>

          {canManage && history.length > 0 ? (
            <section className="card card-pad">
              <h2 style={{ fontSize: "1.1rem" }}>Status history</h2>
              <ol className="timeline">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <div className="when">
                      {formatDateTime(entry.createdAt, user.timezone)}
                    </div>
                    <div className="what">{historyLabel(entry)}</div>
                    <div className="detail">
                      {entry.actorName ?? "System"}
                      {entry.from && entry.to ? ` · ${entry.from} → ${entry.to}` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="card card-pad">
            <h2 style={{ fontSize: "1.1rem" }}>Related</h2>
            <dl className="kv">
              <dt>Resource</dt>
              <dd>
                <Link href={`/resources/${resource.id}`}>{resource.name}</Link> ·{" "}
                {resource.assetTag}
              </dd>
              <dt>Booking</dt>
              <dd>
                {booking ? (
                  <Link href={`/bookings/${booking.id}`}>View booking</Link>
                ) : (
                  <span className="muted">No booking linked</span>
                )}
              </dd>
              <dt>Reported by</dt>
              <dd>{incident.reporterName ?? "System (automatic from return report)"}</dd>
            </dl>
          </section>
        </div>

        <aside className="stack">
          <section className="card card-pad">
            <h2 style={{ fontSize: "1.05rem" }}>Update status</h2>
            {canManage ? (
              <IncidentStatusForm
                key={incident.status}
                incidentId={incident.id}
                status={incident.status}
                canReopen={canReopen}
              />
            ) : (
              <Alert tone="info">
                Only the resource owner or an administrator can change an incident’s
                status.
              </Alert>
            )}
          </section>
          <div className="alert alert-warning">
            Incident records are append-only in the audit trail; status changes are logged
            with the actor and timestamp.
          </div>
        </aside>
      </div>
    </div>
  );
}
