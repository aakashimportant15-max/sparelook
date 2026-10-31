import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { ResourceForm, ResourceStatusForm } from "@/components/ResourceForm";
import { requirePageRole } from "@/server/page-guards";
import { getResourceById, listOwnerOptions } from "@/server/repos/resources";

export const metadata: Metadata = { title: "Edit resource" };

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePageRole(["ADMIN"], "/admin/resources");
  const { id } = await params;
  const resource = getResourceById(user.institutionId, id);
  if (!resource) notFound();
  const owners = listOwnerOptions(user.institutionId);

  return (
    <div className="container-narrow">
      <PageHeader
        eyebrow={`Administration · ${resource.assetTag}`}
        title={resource.name}
        description="Update resource details, rules and availability state. Changes are audit-logged; status changes are not blocked by existing bookings, so review affected bookings afterwards."
        actions={
          <>
            <Link href={`/resources/${resource.id}`} className="btn btn-secondary">
              View page
            </Link>
            <Link href="/admin/resources" className="btn btn-ghost">
              All resources
            </Link>
          </>
        }
      />

      <div className="stack">
        <section className="card card-pad">
          <h2 style={{ fontSize: "1.15rem" }}>Resource details</h2>
          <ResourceForm
            mode="edit"
            owners={owners}
            initial={{
              id: resource.id,
              name: resource.name,
              type: resource.type,
              assetTag: resource.assetTag,
              location: resource.location,
              description: resource.description,
              accessories: resource.accessories,
              maxDurationHours: resource.maxDurationHours,
              approvalRequired: resource.approvalRequired,
              openTime: resource.openTime,
              closeTime: resource.closeTime,
              allowedGroups: resource.allowedGroups,
              requiredTrainings: resource.requiredTrainings,
              ownerId: resource.ownerId,
            }}
          />
        </section>

        <section className="card card-pad">
          <h2 style={{ fontSize: "1.15rem" }}>Availability state</h2>
          <p className="small muted">
            Maintenance hides the resource from booking. Disabled and archived resources
            are hidden from borrowers entirely.
          </p>
          <ResourceStatusForm resourceId={resource.id} status={resource.status} />
        </section>
      </div>
    </div>
  );
}
