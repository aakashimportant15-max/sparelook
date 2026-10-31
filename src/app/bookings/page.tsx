import type { Metadata } from "next";
import Link from "next/link";
import { BookingBadge } from "@/components/Badges";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { formatRange } from "@/lib/time";
import { requirePageUser } from "@/server/page-guards";
import {
  myBookings,
  waitlistViewForBooking,
  weekHoursFor,
  type WaitlistView,
} from "@/server/services/bookings";
import type { Booking } from "@/domain/types";

export const metadata: Metadata = { title: "My bookings" };

function BookingRow({
  booking,
  timeZone,
  waitlist,
}: {
  booking: Booking;
  timeZone: string;
  waitlist?: WaitlistView | null;
}) {
  return (
    <div className="booking-row">
      <div>
        <div className="row" style={{ gap: 8, marginBottom: 2 }}>
          <Link href={`/bookings/${booking.id}`} className="strong">
            {booking.resourceName ?? "Resource"}
          </Link>
          <BookingBadge status={booking.status} />
          {waitlist ? (
            <span className="badge badge-blue" title={waitlist.explanation}>
              Waitlist #{waitlist.position} of {waitlist.total}
            </span>
          ) : null}
          {booking.late ? <span className="badge badge-amber">Late</span> : null}
          {booking.discrepancy ? (
            <span className="badge badge-red">Discrepancy</span>
          ) : null}
        </div>
        <div className="booking-time">
          {formatRange(booking.startAt, booking.endAt, timeZone)}
        </div>
        <div className="small muted truncate" style={{ maxWidth: "60ch" }}>
          {booking.purpose}
        </div>
      </div>
      <Link href={`/bookings/${booking.id}`} className="btn btn-secondary btn-sm">
        Open
      </Link>
    </div>
  );
}

function Section({
  title,
  description,
  bookings,
  timeZone,
  empty,
  waitlistViews,
}: {
  title: string;
  description: string;
  bookings: Booking[];
  timeZone: string;
  empty: string;
  waitlistViews: Record<string, WaitlistView>;
}) {
  return (
    <section className="card" aria-label={title}>
      <div className="card-header">
        <div>
          <h2 style={{ fontSize: "1.15rem" }}>{title}</h2>
          <p className="small muted" style={{ margin: 0 }}>
            {description}
          </p>
        </div>
        <span className="badge badge-gray">{bookings.length}</span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        {bookings.length === 0 ? (
          <p className="small muted" style={{ padding: 20, margin: 0 }}>
            {empty}
          </p>
        ) : (
          bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              timeZone={timeZone}
              waitlist={waitlistViews[booking.id]}
            />
          ))
        )}
      </div>
    </section>
  );
}

export default async function MyBookingsPage() {
  const user = await requirePageUser("/bookings");
  const groups = myBookings(user);
  const week = weekHoursFor(user);
  const openCount = groups.upcoming.length + groups.active.length;
  const waitlistViews: Record<string, WaitlistView> = {};
  for (const booking of [...groups.upcoming, ...groups.active, ...groups.past]) {
    if (booking.status !== "WAITLISTED") continue;
    const view = waitlistViewForBooking(user, booking);
    if (view) waitlistViews[booking.id] = view;
  }

  return (
    <div className="container">
      <PageHeader
        eyebrow="Borrower dashboard"
        title="My bookings"
        description="Track requests, approved slots, active loans and past returns. Status changes here are the same records the owner and auditor see."
        actions={
          <Link href="/catalogue" className="btn btn-primary">
            Request equipment
          </Link>
        }
      />

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="stat">
          <div className="stat-label">Open bookings</div>
          <div className="stat-value">{openCount}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Booked this week</div>
          <div className="stat-value">
            {week.used.toFixed(1)}
            <span className="small muted" style={{ fontWeight: 500 }}>
              {" "}
              / {week.cap} h
            </span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Past bookings</div>
          <div className="stat-value">{groups.past.length}</div>
        </div>
      </div>

      <div className="stack">
        <Section
          title="Active loans"
          description="Checked out and not yet returned."
          bookings={groups.active}
          timeZone={user.timezone}
          empty="Nothing is checked out right now."
          waitlistViews={waitlistViews}
        />
        <Section
          title="Upcoming"
          description="Pending, approved, waitlisted or starting soon."
          bookings={groups.upcoming}
          timeZone={user.timezone}
          empty="No upcoming requests. Browse the catalogue to book equipment."
          waitlistViews={waitlistViews}
        />
        <Section
          title="Past"
          description="Returned, rejected, cancelled or expired."
          bookings={groups.past}
          timeZone={user.timezone}
          empty="No past bookings yet."
          waitlistViews={waitlistViews}
        />
        {groups.upcoming.length === 0 &&
        groups.active.length === 0 &&
        groups.past.length === 0 ? (
          <EmptyState
            title="Your booking history is empty"
            action={
              <Link href="/catalogue" className="btn btn-primary">
                Browse the catalogue
              </Link>
            }
          >
            Request a camera, recorder or accessory and it will appear here.
          </EmptyState>
        ) : null}
      </div>
    </div>
  );
}
