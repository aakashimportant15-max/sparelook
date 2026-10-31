import type { Metadata } from "next";
import Link from "next/link";
import { BookingBadge } from "@/components/Badges";
import { BookingDecisionActions } from "@/components/BookingActions";
import { Alert, EmptyState, PageHeader } from "@/components/PageHeader";
import { formatRange } from "@/lib/time";
import { requirePageRole } from "@/server/page-guards";
import { requestQueue } from "@/server/services/bookings";

export const metadata: Metadata = { title: "Request queue" };

export default async function RequestQueuePage() {
  const user = await requirePageRole(["OWNER", "ADMIN"], "/manage/requests");
  const queue = requestQueue(user);

  return (
    <div className="container">
      <PageHeader
        eyebrow="Owner workspace"
        title="Booking request queue"
        description="Pending requests across the resources you manage. Requests for the same slot are ranked by 30-day usage, then request time."
        actions={
          <Link href="/bookings" className="btn btn-secondary">
            My bookings
          </Link>
        }
      />

      {queue.overdue.length > 0 || queue.missedPickups.length > 0 ? (
        <div className="stack-sm" style={{ marginBottom: 20 }}>
          {queue.missedPickups.length > 0 ? (
            <Alert
              tone="warning"
              title={`${queue.missedPickups.length} missed pickup(s)`}
            >
              Approved bookings are past their start time and not checked out. The
              borrower may still arrive; cancel from the booking page if needed.
            </Alert>
          ) : null}
          {queue.overdue.length > 0 ? (
            <Alert tone="error" title={`${queue.overdue.length} booking(s) past due`}>
              Items are still checked out beyond their end time. Contact the borrower and
              record the return when it arrives.
            </Alert>
          ) : null}
        </div>
      ) : null}

      {queue.items.length === 0 ? (
        <EmptyState
          title="No pending requests"
          action={
            <Link href="/admin/resources" className="btn btn-secondary">
              Review resources
            </Link>
          }
        >
          New requests will appear here with their fairness rank and eligibility status.
        </EmptyState>
      ) : (
        <div className="stack">
          {queue.items.map((item) => (
            <article className="queue-item" key={item.booking.id}>
              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                  <span
                    className={`rank ${item.rank === 1 ? "first" : ""}`}
                    aria-label={`Rank ${item.rank}`}
                  >
                    {item.rank}
                  </span>
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <Link href={`/bookings/${item.booking.id}`} className="strong">
                        {item.resource.name}
                      </Link>
                      <BookingBadge status={item.booking.status} />
                      {item.competingCount > 1 ? (
                        <span className="badge badge-blue">
                          {item.competingCount} competing
                        </span>
                      ) : null}
                    </div>
                    <div className="small muted">
                      {item.requesterName} ·{" "}
                      {formatRange(
                        item.booking.startAt,
                        item.booking.endAt,
                        user.timezone,
                      )}
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>
                      {item.booking.purpose}
                    </div>
                  </div>
                </div>
                <div className="stack-sm" style={{ minWidth: 150 }}>
                  <div className="tiny muted" style={{ textAlign: "right" }}>
                    30-day usage
                  </div>
                  <div className="strong" style={{ textAlign: "right" }}>
                    {item.usageHours30d.toFixed(1)} h
                  </div>
                  <div className="tiny muted" style={{ textAlign: "right" }}>
                    {item.intendedHours.toFixed(1)} h requested
                  </div>
                </div>
              </div>

              <div className="divider" />

              <div className="row-between" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div className="small muted" style={{ marginBottom: 6 }}>
                    {item.explanation || "Only request for this slot."}
                  </div>
                  {!item.eligibility.eligible ? (
                    <div className="alert alert-warning" role="status">
                      <div>
                        <strong style={{ display: "block" }}>
                          This requester is no longer eligible
                        </strong>
                        {item.eligibility.reasons.map((reason) => (
                          <div key={reason.code} className="small">
                            {reason.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="badge badge-green">Eligible</span>
                  )}
                </div>
                <div style={{ minWidth: 300 }}>
                  <BookingDecisionActions bookingId={item.booking.id} />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
