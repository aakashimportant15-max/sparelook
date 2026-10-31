import { loadLocalEnv } from "../src/db/load-env";

// Read-only smoke test against a running server (production build recommended).
// Usage: npm run build && npm start, then npx tsx scripts/smoke-http.ts

loadLocalEnv();

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEMO_USER_PASSWORD;
const BORROWER = "ananya@riverbend-demo.example";

type Result = { check: string; ok: boolean; detail: string };
const results: Result[] = [];

function record(check: string, ok: boolean, detail: string) {
  results.push({ check, ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${check} - ${detail}\n`);
}

async function get(path: string, cookie?: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : undefined,
    redirect: "manual",
  });
}

async function main(): Promise<void> {
  if (!PASSWORD) throw new Error("DEMO_USER_PASSWORD is not set (checked .env)");

  const landing = await get("/");
  const landingHtml = await landing.text();
  record(
    "landing page",
    landing.status === 200 && landingHtml.includes("SpareLook"),
    `status=${landing.status}`,
  );

  const signInPage = await get("/sign-in");
  record("sign-in page", signInPage.status === 200, `status=${signInPage.status}`);

  const anonymous = await get("/api/me");
  record(
    "unauthenticated /api/me",
    anonymous.status === 401,
    `status=${anonymous.status}`,
  );

  const wrong = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: BORROWER, password: "not-the-real-password" }),
  });
  const wrongBody = (await wrong.json()) as {
    error?: { code?: string; message?: string };
  };
  record(
    "wrong password rejected",
    wrong.status === 401 &&
      wrongBody.error?.code === "UNAUTHENTICATED" &&
      wrongBody.error?.message === "Email or password is incorrect.",
    `status=${wrong.status} code=${wrongBody.error?.code} message="${wrongBody.error?.message}"`,
  );

  const signIn = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: BORROWER, password: PASSWORD }),
  });
  const setCookie = signIn.headers.getSetCookie()[0] ?? "";
  const cookie = setCookie.split(";")[0];
  record(
    "demo sign-in",
    signIn.status === 200 && cookie.startsWith("sharespace_session="),
    `status=${signIn.status} cookie=${cookie ? "session" : "missing"}`,
  );

  const me = await get("/api/me", cookie);
  const meBody = (await me.json()) as { user?: { email?: string; role?: string } };
  record(
    "authenticated /api/me",
    me.status === 200 &&
      meBody.user?.email === BORROWER &&
      meBody.user?.role === "BORROWER",
    `status=${me.status} role=${meBody.user?.role}`,
  );

  const cataloguePage = await get("/catalogue", cookie);
  const catalogueHtml = await cataloguePage.text();
  record(
    "catalogue page",
    cataloguePage.status === 200 && catalogueHtml.includes("Equipment available"),
    `status=${cataloguePage.status}`,
  );

  const resources = await get("/api/resources", cookie);
  const resourcesBody = (await resources.json()) as { items?: unknown[]; total?: number };
  record(
    "resource list",
    resources.status === 200 &&
      resourcesBody.total === 9 &&
      resourcesBody.items?.length === 9,
    `status=${resources.status} total=${resourcesBody.total}`,
  );

  const eligible = await get("/api/resources?eligibleForMe=true", cookie);
  const eligibleBody = (await eligible.json()) as { items?: { eligible?: boolean }[] };
  const eligibleCount = eligibleBody.items?.length ?? -1;
  record(
    "eligibility filter",
    eligible.status === 200 &&
      eligibleCount === 5 &&
      (eligibleBody.items ?? []).every((item) => item.eligible === true),
    `status=${eligible.status} eligible=${eligibleCount}`,
  );

  const bookings = await get("/api/bookings", cookie);
  const bookingsBody = (await bookings.json()) as {
    upcoming?: { id?: string }[];
    active?: { id?: string }[];
    past?: { id?: string }[];
  };
  const firstBooking =
    bookingsBody.upcoming?.[0]?.id ??
    bookingsBody.active?.[0]?.id ??
    bookingsBody.past?.[0]?.id;
  record(
    "my bookings",
    bookings.status === 200 && firstBooking !== undefined,
    `status=${bookings.status} upcoming=${bookingsBody.upcoming?.length ?? 0} active=${bookingsBody.active?.length ?? 0} past=${bookingsBody.past?.length ?? 0}`,
  );

  if (typeof firstBooking === "string") {
    const detail = await get(`/api/bookings/${firstBooking}`, cookie);
    const detailBody = (await detail.json()) as { booking?: { id?: string } };
    record(
      "booking detail",
      detail.status === 200 && detailBody.booking?.id === firstBooking,
      `status=${detail.status} id=${detailBody.booking?.id}`,
    );

    const foreign = await get("/api/bookings/b-approved-r01", cookie);
    record(
      "other requester booking hidden",
      foreign.status === 404,
      `status=${foreign.status}`,
    );
  }

  const manage = await get("/api/manage/requests", cookie);
  record(
    "owner endpoint blocked for borrower",
    manage.status === 403,
    `status=${manage.status}`,
  );

  const signOut = await fetch(`${BASE}/api/auth/sign-out`, {
    method: "POST",
    headers: { cookie },
  });
  const afterSignOut = await get("/api/me", cookie);
  record(
    "sign-out invalidates session",
    signOut.ok && afterSignOut.status === 401,
    `signOut=${signOut.status} me=${afterSignOut.status}`,
  );

  const failures = results.filter((result) => !result.ok).length;
  process.stdout.write(
    `\n${results.length - failures}/${results.length} smoke checks passed.\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
