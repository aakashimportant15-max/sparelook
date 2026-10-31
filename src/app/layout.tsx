import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BrandMark } from "@/components/BrandMark";
import { MainNav } from "@/components/MainNav";
import { getCurrentUser } from "@/server/session";
import { queueCount } from "@/server/services/bookings";
import { signOutAction } from "./actions";

export const metadata: Metadata = {
  title: {
    default: "SpareLook · Riverbend Institute",
    template: "%s · SpareLook",
  },
  description:
    "A fictional campus equipment-sharing demo: find gear, check eligibility, book without conflicts, and record handovers.",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const pending =
    user && (user.role === "OWNER" || user.role === "ADMIN") ? queueCount(user) : 0;

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="demo-banner" role="note">
          <strong>Fictional demo</strong> · Riverbend Institute of Technology · Sample
          data only · Not a production service
        </div>
        <header className="site-header">
          <div className="header-inner">
            <Link href={user ? "/catalogue" : "/"} className="brand">
              <BrandMark />
              SpareLook
            </Link>
            {user ? <MainNav role={user.role} queueCount={pending} /> : null}
            <div className="header-user">
              {user ? (
                <>
                  <div className="user-chip">
                    <span className="avatar" aria-hidden="true">
                      {initials(user.displayName)}
                    </span>
                    <span className="user-meta">
                      <strong>{user.displayName}</strong>
                      <span>{user.role.toLowerCase()}</span>
                    </span>
                  </div>
                  <form action={signOutAction}>
                    <button type="submit" className="btn btn-ghost btn-sm">
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/sign-in" className="btn btn-primary btn-sm">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="footer-grid">
            <div className="footer-brand">
              <BrandMark size={30} />
              <div>
                <strong>SpareLook</strong>
                <span className="tagline">
                  Find what&rsquo;s available. Share what&rsquo;s valuable.
                </span>
              </div>
            </div>
            <div>
              <h3>A fictional institution</h3>
              <p>Riverbend Institute of Technology · Sample data only · Not a production service.</p>
            </div>
            <div>
              <h3>More value, less waste</h3>
              <p>Shared resources for a stronger campus. All names, assets and bookings are sample data.</p>
            </div>
          </div>
          <div className="footer-legal">
            SpareLook · demonstration build for a fictional institution. No AI services are used.
          </div>
        </footer>
      </body>
    </html>
  );
}
