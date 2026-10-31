import type { Metadata } from "next";
import Link from "next/link";
import { ResourceBadge } from "@/components/Badges";
import { PageHeader } from "@/components/PageHeader";
import { typeLabel } from "@/components/ResourceIcon";
import { requirePageRole } from "@/server/page-guards";
import { listResources } from "@/server/repos/resources";

export const metadata: Metadata = { title: "Manage resources" };

export default async function AdminResourcesPage() {
  const user = await requirePageRole(["ADMIN"], "/admin/resources");
  const { items } = listResources({
    institutionId: user.institutionId,
    includeHidden: true,
    limit: 200,
  });

  return (
    <div className="container">
      <PageHeader
        eyebrow="Administration"
        title="Resources"
        description="Every resource in the institution, including disabled and archived items. Owners manage their own resources; administrators can change any record."
        actions={
          <Link href="/admin/resources/new" className="btn btn-primary">
            New resource
          </Link>
        }
      />

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Resource</th>
              <th scope="col">Category</th>
              <th scope="col">Owner</th>
              <th scope="col">Approval</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((resource) => (
              <tr key={resource.id}>
                <td>
                  <Link href={`/resources/${resource.id}`} className="strong">
                    {resource.name}
                  </Link>
                  <div className="tiny mono muted">{resource.assetTag}</div>
                </td>
                <td>{typeLabel(resource.type)}</td>
                <td>{resource.ownerName ?? "—"}</td>
                <td>{resource.approvalRequired ? "Required" : "Auto"}</td>
                <td>
                  <ResourceBadge status={resource.status} />
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    <Link
                      href={`/admin/resources/${resource.id}/edit`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/resources/${resource.id}/passport`}
                      className="btn btn-ghost btn-sm"
                    >
                      Passport
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 ? (
        <p className="small muted" style={{ marginTop: 16 }}>
          No resources yet. Create the first one.
        </p>
      ) : null}
    </div>
  );
}
