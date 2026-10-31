import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConditionBadge, ResourceBadge } from "@/components/Badges";
import { Alert, PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/time";
import { isAppError } from "@/lib/errors";
import { requirePageUser } from "@/server/page-guards";
import { passportFor } from "@/server/services/passport";

export const metadata: Metadata = { title: "Resource Passport" };

const KIND_LABEL: Record<string, string> = {
  BOOKING: "Booking",
  CONDITION: "Condition",
  INCIDENT: "Incident",
  RESOURCE: "Resource",
  AUDIT: "Audit",
};

export default async function PassportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  let passport: ReturnType<typeof passportFor>;
  try {
    passport = passportFor(user, id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { resource, full, summary, timeline } = passport;

  return (
    <div className="container">
      <PageHeader
        eyebrow={`Resource Passport · ${resource.assetTag}`}
        title={resource.name}
        description="A practical record of this asset: current status, handover evidence, incidents and the audit trail. It is a normal database-backed history, not a blockchain or tamper-proof ledger."
        actions={
          <>
            <ResourceBadge status={resource.status} />
            <Link href={`/resources/${resource.id}`} className="btn btn-secondary">
              Resource page
            </Link>
          </>
        }
      />

      {!full ? (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="info" title="Summary view">
            You can see your own bookings and incidents for this resource. The full
            condition history, owner notes and audit trail are visible to the resource
            owner and administrators.
          </Alert>
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Completed bookings</div>
          <div className="stat-value">{summary.completedBookings}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Resolved incidents</div>
          <div className="stat-value">{summary.resolvedIncidents}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Last return condition</div>
          <div className="stat-value" style={{ fontSize: "1rem", marginTop: 8 }}>
            {summary.lastReturnCondition ? (
              <ConditionBadge condition={summary.lastReturnCondition} />
            ) : (
              <span className="small muted">No returns yet</span>
            )}
          </div>
        </div>
      </div>

      <div className="split">
        <section className="card" aria-labelledby="timeline-heading">
          <div className="card-header">
            <div>
              <h2 id="timeline-heading" style={{ fontSize: "1.15rem" }}>
                {full ? "Full timeline" : "Your history with this resource"}
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                Newest events are shown last, in {user.timezone.replace("_", " ")} time.
              </p>
            </div>
            <span className="badge badge-gray">{timeline.length} events</span>
          </div>
          <div className="card-body">
            {timeline.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                No recorded events yet.
              </p>
            ) : (
              <ol className="timeline">
                {timeline.map((event) => (
                  <li key={event.id}>
                    <div className="when">
                      {formatDateTime(event.at, user.timezone)} ·{" "}
                      {KIND_LABEL[event.kind] ?? event.kind}
                    </div>
                    <div className="what">
                      {event.href ? (
                        <Link href={event.href}>{event.title}</Link>
                      ) : (
                        event.title
                      )}
                    </div>
                    {event.detail ? <div className="detail">{event.detail}</div> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        <aside className="stack">
          <section className="card card-pad">
            <h2 style={{ fontSize: "1.05rem" }}>Upcoming blocked windows</h2>
            {summary.upcomingBusyBlocks.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                No approved bookings in the next 30 days.
              </p>
            ) : (
              <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
                {summary.upcomingBusyBlocks.map((block) => (
                  <li key={`${block.startAt}-${block.endAt}`} className="small">
                    {formatDateTime(block.startAt, user.timezone)} →{" "}
                    {formatDateTime(block.endAt, user.timezone)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {full ? (
            <section className="card card-pad">
              <h2 style={{ fontSize: "1.05rem" }}>Visibility and privacy</h2>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  Condition reports and incidents are visible to involved borrowers and
                  managers.
                </li>
                <li>
                  Busy windows are shown to other members without the borrower’s identity.
                </li>
                <li>
                  Audit events store actions and identifiers, never passwords or tokens.
                </li>
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
