import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/SignInForm";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

function DemoAccountIcon({ kind }: { kind: "borrower" | "owner" | "admin" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (kind === "owner") {
    return (
      <svg {...common}>
        <rect x="2.5" y="7" width="13" height="10" rx="2" />
        <path d="M15.5 10.5 21 8v8l-5.5-2.5" />
        <circle cx="8" cy="12" r="2.2" />
      </svg>
    );
  }
  if (kind === "admin") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 4 2.5 8.5 12 13l9.5-4.5L12 4Z" />
      <path d="M6.5 10.8V15c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.2M21 8.5V14" />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ signedOut?: string; next?: string; email?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/catalogue");
  const params = await searchParams;

  const accounts: Array<[string, string, "borrower" | "owner" | "admin"]> = [
    ["Borrower · media club", "ananya@riverbend-demo.example", "borrower"],
    ["Borrower · no training", "dev@riverbend-demo.example", "borrower"],
    ["Borrower · heavy usage", "sana@riverbend-demo.example", "borrower"],
    ["Owner · cameras and audio", "kabir@riverbend-demo.example", "owner"],
    ["Owner · test equipment", "nikhil@riverbend-demo.example", "owner"],
    ["Administrator", "meera@riverbend-demo.example", "admin"],
  ];

  return (
    <section className="art-hero">
      <div className="auth-grid">
        <div className="auth-intro">
          <div className="art-eyebrow">Riverbend Institute of Technology</div>
          <h1>Make more of what we have.</h1>
          <p className="lede">
            Discover, book and share equipment and spaces across campus. Fair access
            for everyone.
          </p>
          <p className="small muted">
            Every name, asset and booking in this build is fictional sample data.
          </p>
        </div>

        <div className="auth-card">
          <div className="card-eyebrow">Demo access</div>
          <h2>Sign in to SpareLook</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            Use one of the demo accounts on the right to explore the borrower, owner,
            or administrator experience.
          </p>
          {params.signedOut ? (
            <div
              className="alert alert-success"
              role="status"
              style={{ marginBottom: 16 }}
            >
              You have been signed out.
            </div>
          ) : null}
          <SignInForm
            defaultNext={params.next ?? "/catalogue"}
            initialEmail={params.email ?? ""}
          />
          <div className="auth-note">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
            </svg>
            <span>
              The demo password is supplied through the local{" "}
              <code>DEMO_USER_PASSWORD</code> environment variable and is never
              displayed in this interface. See the README for the local setup
              command.
            </span>
          </div>
        </div>

        <aside className="demo-panel" aria-label="Demo accounts">
          <h2>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="8" r="3" />
              <path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
              <circle cx="17" cy="9" r="2.4" />
              <path d="M15.5 14.6c2.6.2 4.4 1.6 5 4.4" />
            </svg>
            Demo accounts
          </h2>
          <p className="small muted">
            All accounts belong to the fictional Riverbend Institute of Technology.
            Click &ldquo;Select&rdquo; to auto-fill the email address.
          </p>
          <div>
            {accounts.map(([label, email, kind]) => (
              <div key={email} className={`demo-account ${kind}`}>
                <span className="demo-icon">
                  <DemoAccountIcon kind={kind} />
                </span>
                <span className="demo-meta">
                  <strong>{label}</strong>
                  <span>{email}</span>
                </span>
                <Link
                  href={`/sign-in?email=${encodeURIComponent(email)}`}
                  className="btn btn-ghost btn-sm"
                >
                  Select
                </Link>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
