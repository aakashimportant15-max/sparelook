import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ResourceForm } from "@/components/ResourceForm";
import { requirePageRole } from "@/server/page-guards";
import { listOwnerOptions } from "@/server/repos/resources";

export const metadata: Metadata = { title: "New resource" };

export default async function NewResourcePage() {
  const user = await requirePageRole(["ADMIN"], "/admin/resources/new");
  const owners = listOwnerOptions(user.institutionId);

  return (
    <div className="container-narrow">
      <PageHeader
        eyebrow="Administration"
        title="Add a resource"
        description="Create a new bookable asset. Every field is validated on the server; the asset tag must be unique in this institution."
        actions={
          <Link href="/admin/resources" className="btn btn-secondary">
            Back to resources
          </Link>
        }
      />
      <div className="card card-pad">
        <ResourceForm
          mode="create"
          owners={owners}
          initial={{
            name: "",
            type: "CAMERA",
            assetTag: "",
            location: "",
            description: "",
            accessories: [],
            maxDurationHours: 24,
            approvalRequired: true,
            openTime: "09:00",
            closeTime: "21:00",
            allowedGroups: [],
            requiredTrainings: [],
            ownerId: owners[0]?.id ?? "",
          }}
        />
      </div>
    </div>
  );
}
