import type { Metadata } from "next";
import Link from "next/link";
import { ResourceBadge } from "@/components/Badges";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { ResourceIcon, typeLabel } from "@/components/ResourceIcon";
import { requirePageUser } from "@/server/page-guards";
import { listCatalogue } from "@/server/services/resources";

export const metadata: Metadata = { title: "Catalogue" };

const TYPES = [
  ["", "All categories"],
  ["CAMERA", "Cameras"],
  ["AUDIO", "Audio"],
  ["LIGHTING", "Lighting"],
  ["TEST_EQUIPMENT", "Test equipment"],
  ["ACCESSORY", "Accessories"],
] as const;

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    eligibleForMe?: string;
    page?: string;
  }>;
}) {
  const user = await requirePageUser("/catalogue");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const type = params.type ?? "";
  const eligibleOnly = params.eligibleForMe === "true";
  const page = Math.max(1, Number(params.page ?? "1") || 1);

  const result = listCatalogue(user, {
    q: q || undefined,
    type: type || undefined,
    eligibleOnly,
    page,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (type) search.set("type", type);
    if (eligibleOnly) search.set("eligibleForMe", "true");
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return suffix ? `/catalogue?${suffix}` : "/catalogue";
  }

  return (
    <div className="container">
      <PageHeader
        eyebrow="Resource catalogue"
        title="Equipment available across campus"
        description="Search the shared inventory, check eligibility at a glance, and open a resource to request a time slot."
        actions={
          user.role === "ADMIN" ? (
            <Link href="/admin/resources/new" className="btn btn-primary">
              Add resource
            </Link>
          ) : null
        }
      />

      <form className="filter-bar" method="get" role="search">
        <div className="field" style={{ flex: 2 }}>
          <label htmlFor="q">Search</label>
          <input
            id="q"
            name="q"
            className="input"
            defaultValue={q}
            placeholder="Camera, drone, audio recorder…"
          />
        </div>
        <div className="field">
          <label htmlFor="type">Category</label>
          <select id="type" name="type" className="select" defaultValue={type}>
            {TYPES.map(([value, label]) => (
              <option key={value || "all"} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="checkbox" style={{ paddingBottom: 10 }}>
          <input
            type="checkbox"
            name="eligibleForMe"
            value="true"
            defaultChecked={eligibleOnly}
          />
          Only show what I can book
        </label>
        <button type="submit" className="btn btn-secondary">
          Apply filters
        </button>
        {q || type || eligibleOnly ? (
          <Link href="/catalogue" className="btn btn-ghost">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="row-between" style={{ marginBottom: 16 }}>
        <p className="small muted" style={{ margin: 0 }}>
          {result.total} {result.total === 1 ? "resource" : "resources"}
          {q ? ` matching “${q}”` : ""}
        </p>
        <span className="small muted">
          Times shown in {user.timezone.replace("_", " ")}
        </span>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title="No resources match those filters"
          action={
            <Link href="/catalogue" className="btn btn-secondary">
              Show everything
            </Link>
          }
        >
          Try a broader search term or clear the eligibility filter.
        </EmptyState>
      ) : (
        <>
          <div className="resource-grid">
            {result.items.map((item) => (
              <article className="resource-card" key={item.id}>
                <div className="resource-thumb">
                  <span className="thumb-tag">{item.assetTag}</span>
                  <ResourceIcon type={item.type} />
                </div>
                <div className="resource-body">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="eyebrow">{typeLabel(item.type)}</span>
                    <span className="tiny muted">·</span>
                    <span className="tiny muted">{item.location}</span>
                  </div>
                  <h3>
                    <Link href={`/resources/${item.id}`}>{item.name}</Link>
                  </h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {item.description.length > 110
                      ? `${item.description.slice(0, 110)}…`
                      : item.description}
                  </p>
                  <div className={`eligibility-line ${item.eligible ? "ok" : "no"}`}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      aria-hidden="true"
                    >
                      {item.eligible ? (
                        <path
                          d="M20 6 9 17l-5-5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : (
                        <path
                          d="M12 8v5M12 16h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                    <span>
                      {item.eligible ? "You can request this" : item.eligibilityHint}
                    </span>
                  </div>
                  <div className="resource-foot">
                    <span>{item.nextFree}</span>
                    <ResourceBadge status={item.status} />
                  </div>
                </div>
              </article>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav
              className="row"
              aria-label="Catalogue pages"
              style={{ marginTop: 24, justifyContent: "center" }}
            >
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm">
                  Previous
                </Link>
              ) : null}
              <span className="small muted">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm">
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
