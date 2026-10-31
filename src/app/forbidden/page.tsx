import Link from "next/link";
import { getCurrentUser } from "@/server/session";

export default async function ForbiddenPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-narrow" style={{ textAlign: "center", paddingTop: 72 }}>
      <div className="eyebrow">403 · Permission denied</div>
      <h1>This area is for a different role</h1>
      <p className="muted">
        {user
          ? `You are signed in as ${user.displayName} (${user.role.toLowerCase()}). This page is not available to that role.`
          : "Sign in first. This page is only available to specific roles."}
      </p>
      <p className="small muted">
        Permission checks run on the server as well as in the interface, so changing a URL
        or calling the API directly will not grant access.
      </p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link href="/catalogue" className="btn btn-primary">
          Back to the catalogue
        </Link>
        {user ? null : (
          <Link href="/sign-in" className="btn btn-secondary">
            Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
