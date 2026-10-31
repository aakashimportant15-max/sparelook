import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingBadge, ConditionBadge, ResourceBadge } from "@/components/Badges";
import {
  BookingDecisionActions,
  CancelBookingForm,
  ConditionForm,
} from "@/components/BookingActions";
import { IncidentReportForm } from "@/components/IncidentReportForm";
import { Alert, PageHeader } from "@/components/PageHeader";
import { formatDateTime, formatRange, formatTime } from "@/lib/time";
import { isAppError } from "@/lib/errors";
import type { BookingStatus } from "@/domain/types";
import { canManageResource } from "@/server/authz";
import { requirePageUser } from "@/server/page-guards";
import { bookingDetail } from "@/server/services/bookings";

export const metadata: Metadata = { title: "Booking" };

const STEPS: { key: string; label: string; statuses: BookingStatus[] }[] = [
  {
    key: "requested",
    label: "Requested",
    statuses: ["PENDING", "APPROVED", "CHECKED_OUT", "RETURNED"],
  },
  {
    key: "approved",
    label: "Approved",
    statuses: ["APPROVED", "CHECKED_OUT", "RETURNED"],
  },
  { key: "out", label: "Checked out", statuses: ["CHECKED_OUT", "RETURNED"] },
  { key: "returned", label: "Returned", statuses: ["RETURNED"] },
];

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const { id } = await params;
  const { recorded: recordedRaw } = await searchParams;
  const recorded = Array.isArray(recordedRaw) ? recordedRaw[0] : recordedRaw;
  const recordedLabel =
    recorded === "checkout"
      ? "Checkout recorded"
      : recorded === "return"
        ? "Return recorded"
        : null;

  let detail: ReturnType<typeof bookingDetail>;
  try {
    detail = bookingDetail(user, id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { booking, resource, history, reports, incidents, waitlist } = detail;
  const manager = canManageResource(user, resource);
  const checkoutReport = reports.find((report) => report.type === "CHECKOUT");
  const returnReport = reports.find((report) => report.type === "RETURN");
  const currentStep = STEPS.findIndex((step) => step.statuses.includes(booking.status));

  return (
    <div className="container">
      <PageHeader
        eyebrow={`Booking ${booking.id}`}
        title={booking.resourceName ?? "Booking"}
        description={`${formatRange(booking.startAt, booking.endAt, user.timezone)} · ${
          booking.requesterName ?? "Member"
        }`}
        actions={
          <>
            <BookingBadge status={booking.status} />
            <ResourceBadge status={resource.status} />
            <Link href={`/resources/${resource.id}`} className="btn btn-secondary">
              View resource
            </Link>
          </>
        }
      />

      {recordedLabel ? (
        <Alert tone="success" title={recordedLabel}>
          {recorded === "checkout"
            ? "The booking is now checked out. The condition evidence below is the permanent record."
            : "The return is recorded. Any discrepancy has opened an incident automatically."}
        </Alert>
      ) : null}

      <div className="split">
        <div className="stack">
          <section className="card card-pad" aria-label="Booking progress">
            {["REJECTED", "CANCELLED", "EXPIRED", "WAITLISTED"].includes(
              booking.status,
            ) ? (
              <Alert
                tone={booking.status === "WAITLISTED" ? "info" : "warning"}
                title={
                  booking.status === "WAITLISTED"
                    ? "This request is on the waitlist"
                    : booking.status === "REJECTED"
                      ? "This request was rejected"
                      : booking.status === "CANCELLED"
                        ? "This booking was cancelled"
                        : "This request expired"
                }
              >
                <div className="stack-sm">
                  <span>
                    {booking.decisionReason
                      ? booking.decisionReason
                      : booking.status === "WAITLISTED"
                        ? "If the approved booking is cancelled, the fairest eligible request is promoted automatically."
                        : booking.status === "EXPIRED"
                          ? "The start time passed before the request was approved."
                          : "No reason was recorded."}
                  </span>
                  {booking.status === "WAITLISTED" && waitlist ? (
                    <>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="badge badge-blue">
                          Waitlist #{waitlist.position} of {waitlist.total}
                        </span>
                        <span className="small muted">
                          30-day usage: {waitlist.usageHours30d.toFixed(1)} h
                        </span>
                      </div>
                      <p className="small" style={{ margin: 0 }}>
                        {waitlist.explanation}
                      </p>
                      <p className="tiny muted" style={{ margin: 0 }}>
                        Next step: if the approved booking is cancelled, the fairest
                        eligible waitlisted request is promoted automatically. Your
                        position updates whenever the waitlist changes; you will see the
                        new status in your bookings.
                      </p>
                    </>
                  ) : null}
                </div>
              </Alert>
            ) : (
              <div className="stepper" aria-label="Booking progress">
                {STEPS.map((step, index) => {
                  const done = currentStep > index;
                  const current = currentStep === index;
                  return (
                    <div
                      key={step.key}
                      className={`stepper-step ${done ? "done" : ""} ${current ? "current" : ""}`}
                      aria-current={current ? "step" : undefined}
                    >
                      <span className="stepper-dot">{done ? "✓" : index + 1}</span>
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Requested by</dt>
              <dd>{booking.requesterName ?? "Member"}</dd>
              <dt>Purpose</dt>
              <dd>{booking.purpose}</dd>
              <dt>Window</dt>
              <dd>
                {formatDateTime(booking.startAt, user.timezone)} –{" "}
                {formatTime(booking.endAt, user.timezone)}{" "}
                <span className="muted">({user.timezone.replace("_", " ")})</span>
              </dd>
              <dt>Created</dt>
              <dd>{formatDateTime(booking.createdAt, user.timezone)}</dd>
              {booking.decisionReason ? (
                <>
                  <dt>Decision note</dt>
                  <dd>{booking.decisionReason}</dd>
                </>
              ) : null}
              <dt>Handover model</dt>
              <dd>Owner/manager records checkout and return condition reports.</dd>
            </dl>

            {booking.fairnessSnapshot ? (
              <>
                <div className="divider" />
                <div className="row" style={{ gap: 10 }}>
                  <span className="badge badge-teal">FairShare snapshot</span>
                  <span className="small muted">
                    Rank #{booking.fairnessSnapshot.rank} of{" "}
                    {booking.fairnessSnapshot.competingCount} · 30-day usage{" "}
                    {booking.fairnessSnapshot.usageHours30d.toFixed(1)} h · rule{" "}
                    {booking.fairnessSnapshot.rule}
                  </span>
                </div>
              </>
            ) : null}
          </section>

          <section className="card" aria-labelledby="condition-heading">
            <div className="card-header">
              <h2 id="condition-heading" style={{ fontSize: "1.15rem" }}>
                Condition evidence
              </h2>
            </div>
            <div className="card-body stack">
              {reports.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  No condition reports yet. The owner records one at checkout and another
                  at return.
                </p>
              ) : null}
              {[checkoutReport, returnReport].filter(Boolean).map((report) => {
                if (!report) return null;
                return (
                  <div key={report.id}>
                    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                      <strong className="small">
                        {report.type === "CHECKOUT" ? "Checkout" : "Return"}
                      </strong>
                      <ConditionBadge condition={report.overallCondition} />
                      <span className="tiny muted">
                        {formatDateTime(report.createdAt, user.timezone)} ·{" "}
                        {report.recordedByName ?? "Manager"}
                      </span>
                    </div>
                    <div className="stack-sm">
                      {Object.entries(report.checklist).map(([item, value]) => (
                        <div className="checklist-item" key={item}>
                          <span className="small">{item}</span>
                          <span
                            className={`small condition-value ${value === "MISSING" ? "bad" : ""}`}
                          >
                            {value === "PRESENT" ? "Present" : "Missing"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {report.notes ? (
                      <p
                        className="small muted"
                        style={{ marginTop: 8, marginBottom: 0 }}
                      >
                        “{report.notes}”
                      </p>
                    ) : null}
                    <div className="divider" style={{ marginBottom: 0 }} />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card" aria-labelledby="history-heading">
            <div className="card-header">
              <h2 id="history-heading" style={{ fontSize: "1.15rem" }}>
                Status history
              </h2>
            </div>
            <div className="card-body">
              <ol className="timeline">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <div className="when">
                      {formatDateTime(entry.createdAt, user.timezone)}
                    </div>
                    <div className="what">
                      {entry.fromStatus ? `${entry.fromStatus} → ` : ""}
                      {entry.toStatus}
                    </div>
                    <div className="detail">
                      {entry.actorName ?? "System"}
                      {entry.reasonCode
                        ? ` · ${entry.reasonCode.replaceAll("_", " ").toLowerCase()}`
                        : ""}
                      {entry.reasonText ? ` · “${entry.reasonText}”` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {incidents.length > 0 ? (
            <section className="card" aria-labelledby="incidents-heading">
              <div className="card-header">
                <h2 id="incidents-heading" style={{ fontSize: "1.15rem" }}>
                  Related incidents
                </h2>
              </div>
              <div className="card-body stack-sm">
                {incidents.map((incident) => (
                  <div className="row-between" key={incident.id}>
                    <div>
                      <Link href={`/incidents/${incident.id}`} className="strong small">
                        {incident.type.replaceAll("_", " ").toLowerCase()}
                      </Link>
                      <div className="tiny muted">{incident.description}</div>
                    </div>
                    <span className="badge badge-gray">{incident.status}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack">
          {detail.canApprove ? (
            <section className="card" aria-labelledby="decision-heading">
              <div className="card-header">
                <h2 id="decision-heading" style={{ fontSize: "1.1rem" }}>
                  Owner decision
                </h2>
              </div>
              <div className="card-body">
                <BookingDecisionActions bookingId={booking.id} />
              </div>
            </section>
          ) : null}

          {detail.canCheckout ? (
            <section className="card" aria-labelledby="checkout-heading">
              <div className="card-header">
                <h2 id="checkout-heading" style={{ fontSize: "1.1rem" }}>
                  Checkout handover
                </h2>
              </div>
              <div className="card-body">
                <p className="tiny muted" style={{ marginTop: 0 }}>
                  Checkout opens 30 minutes before the start (
                  {formatDateTime(detail.checkoutOpenAt, user.timezone)}).
                </p>
                <ConditionForm
                  bookingId={booking.id}
                  mode="checkout"
                  accessories={resource.accessories}
                />
              </div>
            </section>
          ) : null}

          {detail.canReturn ? (
            <section className="card" aria-labelledby="return-heading">
              <div className="card-header">
                <h2 id="return-heading" style={{ fontSize: "1.1rem" }}>
                  Return handover
                </h2>
              </div>
              <div className="card-body">
                <ConditionForm
                  bookingId={booking.id}
                  mode="return"
                  accessories={resource.accessories}
                  initialChecklist={checkoutReport?.checklist}
                  checkoutCondition={checkoutReport?.overallCondition}
                />
              </div>
            </section>
          ) : null}

          <section className="card card-pad">
            <h2 style={{ fontSize: "1.05rem" }}>Booking actions</h2>
            <div className="stack-sm">
              {detail.canCancel ? (
                <CancelBookingForm
                  bookingId={booking.id}
                  requireReason={manager && booking.requesterId !== user.id}
                />
              ) : (
                <p className="small muted" style={{ margin: 0 }}>
                  No cancellation is available in the current state.
                </p>
              )}
              {manager && booking.status === "APPROVED" ? (
                <Link href={`/manage/requests`} className="btn btn-ghost">
                  Back to request queue
                </Link>
              ) : null}
            </div>
          </section>

          {booking.requesterId === user.id || manager ? (
            <section className="card card-pad">
              <h2 style={{ fontSize: "1.05rem" }}>Something went wrong?</h2>
              <p className="small muted">
                Report damage, a missing accessory, a late return or a condition dispute.
                The owner and administrators will see it.
              </p>
              <IncidentReportForm resourceId={resource.id} bookingId={booking.id} />
            </section>
          ) : null}

          {manager &&
          incidents.length === 0 &&
          ["CHECKED_OUT", "RETURNED"].includes(booking.status) ? (
            <div className="alert alert-info">
              Need to flag something? Record discrepancies in the return report or open an
              incident from the resource page.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
