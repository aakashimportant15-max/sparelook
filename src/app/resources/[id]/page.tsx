import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/BookingForm";
import { ConditionBadge, ResourceBadge } from "@/components/Badges";
import { Alert, PageHeader } from "@/components/PageHeader";
import { ResourceIcon, typeLabel } from "@/components/ResourceIcon";
import { addDays, addMinutes, formatRange, toLocalInputValue } from "@/lib/time";
import { isAppError } from "@/lib/errors";
import { nextLocalQuarterHour } from "@/domain/validation";
import { canManageResource } from "@/server/authz";
import { requirePageUser } from "@/server/page-guards";
import { getCurrentUser } from "@/server/session";
import { passportFor } from "@/server/services/passport";
import { resourceDetail } from "@/server/services/resources";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: "Resource" };
  const { id } = await params;
  try {
    const { resource } = resourceDetail(user, id);
    return { title: resource.name };
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageUser();
  const { id } = await params;

  let data: ReturnType<typeof resourceDetail>;
  try {
    data = resourceDetail(user, id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { resource, availability, eligibility } = data;
  const manager = canManageResource(user, resource);
  const passport = passportFor(user, resource.id);
  const now = new Date();
  const start = nextLocalQuarterHour(addMinutes(now, 30), user.timezone);
  const end = addMinutes(start, 120);

  return (
    <div className="container">
      <PageHeader
        eyebrow={`${typeLabel(resource.type)} · ${resource.assetTag}`}
        title={resource.name}
        description={resource.description}
        actions={
          <>
            <Link
              href={`/resources/${resource.id}/passport`}
              className="btn btn-secondary"
            >
              Resource Passport
            </Link>
            {manager ? (
              <Link
                href={`/admin/resources/${resource.id}/edit`}
                className="btn btn-secondary"
              >
                Edit resource
              </Link>
            ) : null}
          </>
        }
      />

      <div className="split">
        <div className="stack">
          <section className="card" aria-labelledby="details-heading">
            <div className="card-header">
              <h2 id="details-heading">Resource details</h2>
              <ResourceBadge status={resource.status} />
            </div>
            <div className="card-body">
              <dl className="kv">
                <dt>Location</dt>
                <dd>{resource.location}</dd>
                <dt>Managed by</dt>
                <dd>{resource.ownerName ?? "Resource owner"}</dd>
                <dt>Approval</dt>
                <dd>
                  {resource.approvalRequired
                    ? "Owner approval required"
                    : "Auto-approved"}
                </dd>
                <dt>Booking window</dt>
                <dd>
                  Up to {resource.maxDurationHours} h per booking
                  {resource.openTime && resource.closeTime
                    ? ` · ${resource.openTime}–${resource.closeTime} ${user.timezone.replace("_", " ")}`
                    : " · any time"}
                </dd>
                <dt>Who can book</dt>
                <dd>
                  {resource.allowedGroups.length === 0
                    ? "Any member of this institution"
                    : resource.allowedGroups.join(", ")}
                  {resource.requiredTrainings.length > 0
                    ? ` · training: ${resource.requiredTrainings.join(", ")}`
                    : ""}
                </dd>
              </dl>

              <div className="divider" />
              <h3 style={{ fontSize: "0.95rem" }}>Accessories tracked at handover</h3>
              <div className="pill-list">
                {resource.accessories.map((item) => (
                  <span className="pill" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="availability-heading">
            <div className="card-header">
              <h2 id="availability-heading">Availability · next 30 days</h2>
            </div>
            <div className="card-body">
              {availability.length === 0 ? (
                <p className="small muted" style={{ margin: 0 }}>
                  No approved bookings in the next 30 days. The whole window is open.
                </p>
              ) : (
                <ul
                  className="stack-sm"
                  style={{ margin: 0, padding: 0, listStyle: "none" }}
                >
                  {availability.map((block) => (
                    <li key={`${block.startAt}-${block.endAt}`} className="row-between">
                      <span className="small">
                        {formatRange(block.startAt, block.endAt, user.timezone)}
                      </span>
                      <span className="badge badge-gray">Booked</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="tiny muted" style={{ marginTop: 12, marginBottom: 0 }}>
                Busy windows are anonymised: other members’ identities are never shown.
              </p>
            </div>
          </section>

          <section className="card" aria-labelledby="passport-heading">
            <div className="card-header">
              <h2 id="passport-heading">Condition history</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-3">
                <div>
                  <div className="stat-label">Completed bookings</div>
                  <div className="stat-value">{passport.summary.completedBookings}</div>
                </div>
                <div>
                  <div className="stat-label">Resolved incidents</div>
                  <div className="stat-value">{passport.summary.resolvedIncidents}</div>
                </div>
                <div>
                  <div className="stat-label">Last return condition</div>
                  <div
                    className="stat-value"
                    style={{ fontSize: "1.05rem", marginTop: 6 }}
                  >
                    {passport.summary.lastReturnCondition ? (
                      <ConditionBadge condition={passport.summary.lastReturnCondition} />
                    ) : (
                      <span className="muted small">No returns yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="card" aria-labelledby="eligibility-heading">
            <div className="card-header">
              <h2 id="eligibility-heading">Your eligibility</h2>
            </div>
            <div className="card-body">
              {eligibility.eligible ? (
                <Alert tone="success" title="You can request this resource">
                  Your group tags and training records satisfy the requirements.
                </Alert>
              ) : (
                <div className="stack-sm">
                  {eligibility.reasons.map((reason) => (
                    <Alert key={reason.code} tone="warning">
                      {reason.message}
                    </Alert>
                  ))}
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Eligibility is re-checked on the server when you submit and again when
                    the owner approves.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="card" aria-labelledby="request-heading">
            <div className="card-header">
              <h2 id="request-heading">Request a booking</h2>
            </div>
            <div className="card-body">
              {resource.status === "ACTIVE" ? (
                <BookingForm
                  resourceId={resource.id}
                  resourceName={resource.name}
                  timeZone={user.timezone}
                  defaultStart={toLocalInputValue(start, user.timezone)}
                  defaultEnd={toLocalInputValue(end, user.timezone)}
                  minStart={toLocalInputValue(now, user.timezone)}
                  maxEnd={toLocalInputValue(addDays(now, 30), user.timezone)}
                  eligible={eligibility.eligible}
                  eligibilityReasons={eligibility.reasons}
                />
              ) : (
                <Alert tone="warning" title="Not currently bookable">
                  This resource is marked{" "}
                  {resource.status.toLowerCase().replace("_", " ")}. Ask the owner or an
                  administrator for details.
                </Alert>
              )}
            </div>
          </section>

          <div className="card card-pad">
            <div className="row" style={{ gap: 12 }}>
              <ResourceIcon type={resource.type} size={34} />
              <div>
                <div className="small strong">Need this for a longer window?</div>
                <p className="tiny muted" style={{ margin: 0 }}>
                  Maximum is {resource.maxDurationHours} h per booking. Contact the owner
                  for exceptions.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
