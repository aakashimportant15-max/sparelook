import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { UserEditor } from "@/components/UserEditor";
import { requirePageRole } from "@/server/page-guards";
import { listUsers } from "@/server/repos/users";

export const metadata: Metadata = { title: "Members" };

export default async function AdminUsersPage() {
  const user = await requirePageRole(["ADMIN"], "/admin/users");
  const users = listUsers(user.institutionId);

  return (
    <div className="container">
      <PageHeader
        eyebrow="Administration"
        title="Members and access tags"
        description="Group and training tags decide eligibility. Changing a tag affects new requests immediately; existing approved bookings keep their records."
      />
      <div className="stack">
        {users.map((member) => (
          <UserEditor key={member.id} user={member} isSelf={member.id === user.id} />
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 16 }}>
        Suspending a member revokes their sessions and blocks new requests. Their history
        remains in the audit trail.
      </p>
    </div>
  );
}
