import Link from "next/link";

export function NotFoundView() {
  return (
    <div className="container-narrow" style={{ textAlign: "center", paddingTop: 72 }}>
      <div className="eyebrow">404</div>
      <h1>We could not find that page</h1>
      <p className="muted">
        The resource, booking or incident may have been removed, or you may not have
        access to it. Access to records you do not own is reported as “not found” on
        purpose.
      </p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link href="/catalogue" className="btn btn-primary">
          Go to the catalogue
        </Link>
        <Link href="/" className="btn btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
