import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime } from "@/lib/time";
import { requirePageRole } from "@/server/page-guards";
import { countAuditEvents, listAuditEvents } from "@/server/audit";

export const metadata: Metadata = { title: "Audit trail" };

function outcomeTone(outcome: string): string {
  if (outcome === "DENIED") return "badge-red";
  if (outcome === "FAILED") return "badge-amber";
  return "badge-green";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; outcome?: string; page?: string }>;
}) {
  const user = await requirePageRole(["ADMIN"], "/admin/audit");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const limit = 50;
  const action = params.action?.trim() ?? "";
  const outcome = params.outcome ?? "";
  const events = listAuditEvents({
    institutionId: user.institutionId,
    action: action || undefined,
    outcome: outcome || undefined,
    limit,
    offset: (page - 1) * limit,
  });
  const total = countAuditEvents(user.institutionId);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  function href(target: number) {
    const search = new URLSearchParams();
    if (action) search.set("action", action);
    if (outcome) search.set("outcome", outcome);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return suffix ? `/admin/audit?${suffix}` : "/admin/audit";
  }

  return (
    <div className="container">
      <PageHeader
        eyebrow="Administration"
        title="Audit trail"
        description="Append-only record of actions, decisions and denied access attempts. Passwords, tokens and sensitive payloads are never stored here."
      />

      <form className="filter-bar" method="get">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="action">Action contains</label>
          <input
            id="action"
            name="action"
            className="input"
            defaultValue={action}
            placeholder="booking.approved"
          />
        </div>
        <div className="field">
          <label htmlFor="outcome">Outcome</label>
          <select id="outcome" name="outcome" className="select" defaultValue={outcome}>
            <option value="">All outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="DENIED">Denied</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          Filter
        </button>
        {action || outcome ? (
          <Link href="/admin/audit" className="btn btn-ghost">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Entity</th>
              <th scope="col">Outcome</th>
              <th scope="col">Request</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td className="small" style={{ whiteSpace: "nowrap" }}>
                  {formatDateTime(event.createdAt, user.timezone)}
                </td>
                <td className="small">{event.actorName ?? "System"}</td>
                <td className="small mono">{event.action}</td>
                <td className="small">
                  {event.entityType}
                  {event.entityId ? (
                    <div className="tiny muted mono">{event.entityId}</div>
                  ) : null}
                </td>
                <td>
                  <span className={`badge ${outcomeTone(event.outcome)}`}>
                    {event.outcome}
                  </span>
                </td>
                <td className="tiny mono muted">{event.requestId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length === 0 ? (
        <p className="small muted" style={{ marginTop: 16 }}>
          No audit events match this filter.
        </p>
      ) : null}

      <nav
        className="row"
        aria-label="Audit pages"
        style={{ marginTop: 20, justifyContent: "center" }}
      >
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn btn-secondary btn-sm">
            Previous
          </Link>
        ) : null}
        <span className="small muted">
          Page {page} of {totalPages} · {total} events
        </span>
        {page < totalPages ? (
          <Link href={href(page + 1)} className="btn btn-secondary btn-sm">
            Next
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
