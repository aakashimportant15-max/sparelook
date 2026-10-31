"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error", error);
  }, [error]);

  return (
    <div className="container-narrow" style={{ textAlign: "center", paddingTop: 72 }}>
      <div className="eyebrow">Something went wrong</div>
      <h1>This page could not be loaded</h1>
      <p className="muted">
        The server reported an error. No booking or approval was silently completed. You
        can try again or return to a safe page.
      </p>
      {error.digest ? <p className="tiny mono muted">Reference: {error.digest}</p> : null}
      <div className="row" style={{ justifyContent: "center" }}>
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/catalogue" className="btn btn-secondary">
          Catalogue
        </Link>
      </div>
    </div>
  );
}
