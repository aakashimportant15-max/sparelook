import Link from "next/link";
import { getCurrentUser } from "@/server/session";

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <>
      <section className="art-hero">
        <div className="art-hero-inner">
          <div>
            <div className="art-eyebrow" style={{ marginBottom: 10 }}>
              Riverbend Institute of Technology
            </div>
            <h1>Make more of what we have.</h1>
            <p className="lede">
              Discover, book and share equipment and spaces across campus. Fair access
              for everyone.
            </p>
            <div className="row">
              <Link
                href={user ? "/catalogue" : "/sign-in"}
                className="btn btn-primary btn-lg"
              >
                {user ? "Open the catalogue" : "Sign in to the demo"}
              </Link>
              <Link href="/catalogue" className="btn btn-secondary btn-lg">
                Browse resources
              </Link>
            </div>
            <div className="value-props">
              {[
                [
                  "Discover resources",
                  "Find equipment and spaces near you",
                  <path
                    key="d"
                    d="M11 4a7 7 0 1 0 4.9 12M21 21l-4.35-4.35"
                    strokeLinecap="round"
                  />,
                ],
                [
                  "Book fairly",
                  "Transparent, equitable allocation",
                  <path
                    key="b"
                    d="M5 12h14M12 5v14M5 5h14v14H5z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />,
                ],
                [
                  "Build a shared campus",
                  "Get more value from what we have",
                  <path
                    key="c"
                    d="M12 21c-4-3-8-5.5-8-10a8 8 0 0 1 16 0c0 4.5-4 7-8 10Z M12 21V8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />,
                ],
              ].map(([title, body, path]) => (
                <div className="value-prop" key={title as string}>
                  <span className="value-icon" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      {path}
                    </svg>
                  </span>
                  <strong>{title}</strong>
                  <span>{body}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-panel" aria-label="How SpareLook works">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              The flow, end to end
            </div>
            {[
              ["Find", "Browse one catalogue with search and category filters."],
              [
                "Check",
                "Eligibility is evaluated from group tags and required training.",
              ],
              [
                "Book",
                "Overlaps are rejected at the database level, not just in the UI.",
              ],
              ["Hand over", "Checkout condition is recorded before the gear leaves."],
              ["Return", "A return report flags discrepancies and creates incidents."],
              ["Audit", "Every decision is written to an append-only trace."],
            ].map(([title, body], index) => (
              <div className="flow-step" key={title}>
                <span className="flow-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <div className="strong">{title}</div>
                  <div className="small muted">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container">
        <div className="feature-grid">
          <div className="feature">
            <div className="feature-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 4V2M16 4V2" strokeLinecap="round" />
              </svg>
            </div>
            <h3>Conflict-free by construction</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Approved and checked-out bookings cannot overlap. A database trigger
              enforces it even if two requests arrive at the same moment.
            </p>
          </div>
          <div className="feature">
            <div className="feature-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M12 3v18M5 7l7-4 7 4M5 17l7 4 7-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>Fair, explainable allocation</h3>
            <p className="small muted" style={{ margin: 0 }}>
              When requests collide, the queue ranks by 30-day usage, then request time.
              Owners see the reasoning; overriding it requires a written reason.
            </p>
          </div>
          <div className="feature">
            <div className="feature-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h3>Evidence on every handover</h3>
            <p className="small muted" style={{ margin: 0 }}>
              Checkout and return reports capture condition and accessories. Missing items
              automatically open an incident for the owner.
            </p>
          </div>
        </div>

        <div className="card card-pad" style={{ marginTop: 24 }}>
          <div className="row-between">
            <div>
              <h2 style={{ marginBottom: 4 }}>What this demo does not do</h2>
              <p className="small muted" style={{ margin: 0, maxWidth: "70ch" }}>
                No AI matching, no payments, no external integrations, no real institution
                data. Consequences for late returns or damage are recorded as incidents
                but are not automated. This is a hackathon-scale MVP for one institution.
              </p>
            </div>
            <Link href="/sign-in" className="btn btn-secondary">
              See the demo accounts
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
