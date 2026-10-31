import fs from "node:fs";
import { loadLocalEnv } from "../src/db/load-env";
import { zonedParts } from "../src/lib/time";

// Executes the D1-D12 demo script through the real HTTP API against a running
// server. Intended to run on a freshly seeded demo database; reset afterwards.

loadLocalEnv();

const BASE = process.env.DEMO_BASE ?? "http://localhost:3000";
const PASSWORD = process.env.DEMO_USER_PASSWORD;
const TZ = "Asia/Kolkata";
const EVIDENCE = "docs/evidence/demo-run.md";

if (!PASSWORD) throw new Error("DEMO_USER_PASSWORD is not set (checked .env)");

type Payload = Record<string, unknown>;
type Outcome = { step: string; ok: boolean; detail: string };
const outcomes: Outcome[] = [];

function record(step: string, ok: boolean, detail: string) {
  outcomes.push({ step, ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${step} - ${detail}\n`);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function nextQuarter(after: Date): Date {
  const step = 15 * 60_000;
  return new Date(Math.ceil((after.getTime() + 2 * 60_000) / step) * step);
}

async function call(
  cookie: string,
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<{ status: number; data: Payload }> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
      ...(headers ?? {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data: Payload = {};
  try {
    data = text ? (JSON.parse(text) as Payload) : {};
  } catch {
    data = { raw: text };
  }
  return { status: response.status, data };
}

let keySequence = 0;

function idempotency(label: string): Record<string, string> {
  keySequence += 1;
  return { "idempotency-key": `demo-${label}-${Date.now()}-${keySequence}` };
}

async function signIn(email: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/sign-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const cookie = (response.headers.getSetCookie()[0] ?? "").split(";")[0];
  if (response.status !== 200 || !cookie) {
    throw new Error(`Sign-in failed for ${email}: status=${response.status}`);
  }
  return cookie;
}

async function main(): Promise<void> {
  const meera = await signIn("meera@riverbend-demo.example");
  const ananya = await signIn("ananya@riverbend-demo.example");
  const rohan = await signIn("rohan@riverbend-demo.example");
  const kabir = await signIn("kabir@riverbend-demo.example");
  const sana = await signIn("sana@riverbend-demo.example");
  const dev = await signIn("dev@riverbend-demo.example");

  // D1 - admin creates a resource.
  const created = await call(meera, "POST", "/api/resources", {
    name: "Wireless Lavalier Mic Set",
    type: "AUDIO",
    assetTag: "RB-AUD-011",
    location: "Media Lab 2",
    description: "Two-channel wireless lavalier kit for interviews and field recording.",
    accessories: ["receiver", "2 batteries", "2 lav mics", "carry case"],
    maxDurationHours: 24,
    approvalRequired: false,
    openTime: "08:00",
    closeTime: "22:00",
    allowedGroups: ["media-club", "film-dept"],
    requiredTrainings: [],
    ownerId: "u-kabir",
  });
  const createdResource = (created.data.resource ?? {}) as { id?: string; name?: string };
  record(
    "D1 admin creates resource",
    created.status === 201 && Boolean(createdResource.id),
    `status=${created.status} id=${createdResource.id ?? "missing"}`,
  );

  const catalogueSearch = await call(ananya, "GET", "/api/resources?q=lavalier");
  const searchItems = (catalogueSearch.data.items ?? []) as { id?: string }[];
  record(
    "D1 resource appears in catalogue",
    searchItems.some((item) => item.id === createdResource.id),
    `status=${catalogueSearch.status} matches=${searchItems.length}`,
  );

  const audit = await call(meera, "GET", "/api/admin/audit?action=resource.created");
  const auditEvents = (audit.data.events ?? []) as {
    entityId?: string;
    action?: string;
  }[];
  record(
    "D1 audit event resource.created",
    auditEvents.some((event) => event.entityId === createdResource.id),
    `status=${audit.status} events=${auditEvents.length}`,
  );

  // D2 - eligible borrower sees the eligibility panel.
  const detail = await call(ananya, "GET", "/api/resources/r01");
  const eligibility = (detail.data.eligibility ?? {}) as {
    eligible?: boolean;
    reasons?: unknown[];
  };
  record(
    "D2 Ananya eligible for R01",
    detail.status === 200 && eligibility.eligible === true,
    `status=${detail.status} eligible=${eligibility.eligible} reasons=${eligibility.reasons?.length ?? 0}`,
  );

  const cameraSearch = await call(ananya, "GET", "/api/resources?q=camera");
  const cameraItems = (cameraSearch.data.items ?? []) as { id?: string }[];
  record(
    "D2 search camera",
    cameraItems.some((item) => item.id === "r01"),
    `status=${cameraSearch.status} matches=${cameraItems.length}`,
  );

  // D3 - borrower requests R01 tomorrow morning.
  const tomorrow = zonedParts(new Date(Date.now() + 24 * 60 * 60_000), TZ);
  const tomorrowStart = `${tomorrow.year}-${pad(tomorrow.month)}-${pad(tomorrow.day)}T16:00`;
  const tomorrowEnd = `${tomorrow.year}-${pad(tomorrow.month)}-${pad(tomorrow.day)}T18:00`;
  const request = await call(
    ananya,
    "POST",
    "/api/bookings",
    {
      resourceId: "r01",
      startAt: tomorrowStart,
      endAt: tomorrowEnd,
      purpose: "Shoot the campus documentary opening scene",
      joinWaitlist: false,
    },
    idempotency("ananya-r01"),
  );
  const ananyaBooking = (request.data.booking ?? {}) as { id?: string; status?: string };
  record(
    "D3 Ananya request is PENDING",
    request.status === 201 && ananyaBooking.status === "PENDING",
    `status=${request.status} booking=${ananyaBooking.id ?? "missing"} state=${ananyaBooking.status}`,
  );

  const queueAfterRequest = await call(kabir, "GET", "/api/manage/requests");
  const queueItems = (queueAfterRequest.data.items ?? []) as {
    booking?: { id?: string };
  }[];
  record(
    "D3 owner queue contains the request",
    queueItems.some((item) => item.booking?.id === ananyaBooking.id),
    `status=${queueAfterRequest.status} pending=${queueItems.length}`,
  );

  // D4 - overlap rejected; adjacent slot accepted.
  const seeded = await call(kabir, "GET", "/api/bookings/b-approved-r01");
  const seededBooking = (seeded.data.booking ?? {}) as {
    startAt?: string;
    endAt?: string;
  };
  const seededStart = seededBooking.startAt ?? "";
  const seededEnd = seededBooking.endAt ?? "";
  const seededStartMs = Date.parse(seededStart);
  const conflictStart = new Date(
    Math.max(seededStartMs + 15 * 60_000, nextQuarter(new Date()).getTime()),
  );
  const conflictEnd = new Date(conflictStart.getTime() + 2 * 60 * 60_000);
  const conflict = await call(
    rohan,
    "POST",
    "/api/bookings",
    {
      resourceId: "r01",
      startAt: conflictStart.toISOString(),
      endAt: conflictEnd.toISOString(),
      purpose: "Backup camera for the same afternoon shoot",
    },
    idempotency("rohan-conflict"),
  );
  const conflictError = (conflict.data.error ?? {}) as {
    code?: string;
    message?: string;
  };
  record(
    "D4 overlapping request blocked",
    conflict.status === 409 && conflictError.code === "BOOKING_CONFLICT",
    `status=${conflict.status} code=${conflictError.code} window=${conflictStart.toISOString()}..${conflictEnd.toISOString()} seeded=${seededStart}..${seededEnd}`,
  );
  record(
    "D4 conflict message hides identities",
    Boolean(conflictError.message) &&
      !/Ananya|Kabir|Meera|Rohan|Sana|Dev|Isha|Nikhil/.test(conflictError.message ?? ""),
    `message="${conflictError.message ?? ""}"`,
  );

  const freeStart = `${tomorrow.year}-${pad(tomorrow.month)}-${pad(tomorrow.day)}T15:00`;
  const freeEnd = `${tomorrow.year}-${pad(tomorrow.month)}-${pad(tomorrow.day)}T16:00`;
  const adjacent = await call(
    rohan,
    "POST",
    "/api/bookings",
    {
      resourceId: "r01",
      startAt: freeStart,
      endAt: freeEnd,
      purpose: "Free slot immediately before the approved request",
    },
    idempotency("rohan-adjacent"),
  );
  const adjacentBooking = (adjacent.data.booking ?? {}) as {
    id?: string;
    status?: string;
  };
  record(
    "D4 non-overlapping request accepted",
    adjacent.status === 201 && adjacentBooking.status === "PENDING",
    `status=${adjacent.status} booking=${adjacentBooking.id ?? "missing"} window=${freeStart}..${freeEnd}`,
  );

  // D5 - owner approves one request, rejects another with a reason.
  if (ananyaBooking.id) {
    const approved = await call(
      kabir,
      "POST",
      `/api/bookings/${ananyaBooking.id}/approve`,
      {},
    );
    const approvedBooking = (approved.data.booking ?? {}) as { status?: string };
    record(
      "D5 approve Ananya request",
      approved.status === 200 && approvedBooking.status === "APPROVED",
      `status=${approved.status} state=${approvedBooking.status}`,
    );
  }

  if (adjacentBooking.id) {
    const reason = "Slot overlaps another confirmed shoot and the kit is not free.";
    const rejected = await call(
      kabir,
      "POST",
      `/api/bookings/${adjacentBooking.id}/reject`,
      {
        reason,
      },
    );
    const rejectedBooking = (rejected.data.booking ?? {}) as {
      status?: string;
      decisionReason?: string;
    };
    record(
      "D5 reject Rohan request with reason",
      rejected.status === 200 &&
        rejectedBooking.status === "REJECTED" &&
        rejectedBooking.decisionReason === reason,
      `status=${rejected.status} state=${rejectedBooking.status} reasonStored=${rejectedBooking.decisionReason === reason}`,
    );
    const rohanView = await call(rohan, "GET", `/api/bookings/${adjacentBooking.id}`);
    const rohanBooking = (rohanView.data.booking ?? {}) as { decisionReason?: string };
    record(
      "D5 requester sees rejection reason",
      rohanView.status === 200 && rohanBooking.decisionReason === reason,
      `status=${rohanView.status} reasonVisible=${rohanBooking.decisionReason === reason}`,
    );
  }

  // D6 - ineligible borrower blocked.
  const devRequest = await call(
    dev,
    "POST",
    "/api/bookings",
    {
      resourceId: "r01",
      startAt: tomorrowStart,
      endAt: tomorrowEnd,
      purpose: "Try to borrow the camera without the required training",
    },
    idempotency("dev-r01"),
  );
  const devError = (devRequest.data.error ?? {}) as {
    code?: string;
    details?: { reasons?: { code?: string }[] };
  };
  const devReasons = (devError.details?.reasons ?? []).map((reason) => reason.code);
  record(
    "D6 Dev blocked with reasons",
    devRequest.status === 422 &&
      devError.code === "NOT_ELIGIBLE" &&
      devReasons.includes("MISSING_GROUP") &&
      devReasons.includes("MISSING_TRAINING"),
    `status=${devRequest.status} code=${devError.code} reasons=${devReasons.join(",")}`,
  );

  // D7 - auto-approved lavalier kit booked now, checked out by the owner.
  const kitStart = nextQuarter(new Date());
  const kitEnd = new Date(kitStart.getTime() + 2 * 60 * 60_000);
  const kitBooking = await call(
    ananya,
    "POST",
    "/api/bookings",
    {
      resourceId: createdResource.id,
      startAt: kitStart.toISOString(),
      endAt: kitEnd.toISOString(),
      purpose: "Record the alumni interview in the media lab",
    },
    idempotency("ananya-kit"),
  );
  const kit = (kitBooking.data.booking ?? {}) as { id?: string; status?: string };
  record(
    "D7 auto-approve lavalier kit",
    kitBooking.status === 201 && kit.status === "APPROVED" && Boolean(kit.id),
    `status=${kitBooking.status} booking=${kit.id ?? "missing"} state=${kit.status}`,
  );

  if (kit.id) {
    const checkout = await call(kabir, "POST", `/api/bookings/${kit.id}/checkout`, {
      overallCondition: "GOOD",
      checklist: {
        receiver: "PRESENT",
        "2 batteries": "PRESENT",
        "2 lav mics": "PRESENT",
        "carry case": "PRESENT",
      },
      notes: "Handed over at the media lab counter.",
    });
    const checkedOut = (checkout.data.booking ?? {}) as { status?: string };
    record(
      "D7 checkout recorded",
      checkout.status === 200 && checkedOut.status === "CHECKED_OUT",
      `status=${checkout.status} state=${checkedOut.status}`,
    );
  }

  // D8 - return with a missing battery and minor wear.
  let incidentId: string | undefined;
  if (kit.id) {
    const returned = await call(kabir, "POST", `/api/bookings/${kit.id}/return`, {
      overallCondition: "MINOR_WEAR",
      checklist: {
        receiver: "PRESENT",
        "2 batteries": "MISSING",
        "2 lav mics": "PRESENT",
        "carry case": "PRESENT",
      },
      notes: "One battery missing from the case; receiver has a small scuff.",
    });
    const returnedBooking = (returned.data.booking ?? {}) as {
      status?: string;
      discrepancy?: boolean;
    };
    const incidents = (returned.data.incidents ?? []) as { id?: string; type?: string }[];
    incidentId = incidents.find((incident) => incident.type === "MISSING_ITEM")?.id;
    record(
      "D8 return flags discrepancy and incident",
      returned.status === 200 &&
        returnedBooking.status === "RETURNED" &&
        returnedBooking.discrepancy === true &&
        Boolean(incidentId),
      `status=${returned.status} state=${returnedBooking.status} discrepancy=${returnedBooking.discrepancy} incident=${incidentId ?? "missing"}`,
    );
  }

  // D9 - incident workflow and borrower visibility.
  if (incidentId) {
    const investigating = await call(
      kabir,
      "PATCH",
      `/api/incidents/${incidentId}/status`,
      {
        status: "INVESTIGATING",
      },
    );
    const resolved = await call(kabir, "PATCH", `/api/incidents/${incidentId}/status`, {
      status: "RESOLVED",
      resolutionNote: "Battery replaced from the spare kit; borrower informed.",
    });
    const resolvedIncident = (resolved.data.incident ?? {}) as { status?: string };
    record(
      "D9 incident resolved",
      investigating.status === 200 &&
        resolved.status === 200 &&
        resolvedIncident.status === "RESOLVED",
      `investigating=${investigating.status} resolved=${resolved.status} state=${resolvedIncident.status}`,
    );

    const ananyaIncidents = await call(ananya, "GET", "/api/incidents");
    const visible = (ananyaIncidents.data.incidents ?? []) as {
      id?: string;
      status?: string;
    }[];
    record(
      "D9 borrower sees the resolved incident",
      visible.some(
        (incident) => incident.id === incidentId && incident.status === "RESOLVED",
      ),
      `status=${ananyaIncidents.status} visible=${visible.length}`,
    );
  }

  // D10 - passport visibility by role.
  const ownerPassport = await call(kabir, "GET", "/api/resources/r01/passport");
  const ownerView = ownerPassport.data as {
    full?: boolean;
    audit?: unknown[];
    timeline?: { at?: string }[];
  };
  const timeline = ownerView.timeline ?? [];
  const ordered = timeline.every(
    (event, index) => index === 0 || (timeline[index - 1]?.at ?? "") <= (event.at ?? ""),
  );
  record(
    "D10 owner sees full passport",
    ownerPassport.status === 200 &&
      ownerView.full === true &&
      (ownerView.audit?.length ?? 0) > 0 &&
      ordered,
    `status=${ownerPassport.status} full=${ownerView.full} audit=${ownerView.audit?.length ?? 0} timeline=${timeline.length} ordered=${ordered}`,
  );

  const borrowerPassport = await call(rohan, "GET", "/api/resources/r01/passport");
  const borrowerView = borrowerPassport.data as {
    full?: boolean;
    audit?: unknown[];
    bookings?: { requesterId?: string }[];
  };
  const borrowerBookings = borrowerView.bookings ?? [];
  record(
    "D10 borrower sees limited passport",
    borrowerPassport.status === 200 &&
      borrowerView.full === false &&
      (borrowerView.audit?.length ?? 0) === 0 &&
      borrowerBookings.length > 0 &&
      borrowerBookings.every((booking) => booking.requesterId === "u-rohan") &&
      !JSON.stringify(borrowerView).includes("Ananya"),
    `status=${borrowerPassport.status} full=${borrowerView.full} audit=${borrowerView.audit?.length ?? 0} ownBookings=${borrowerBookings.length}`,
  );

  // D11 - FairShare ranking and override.
  const r02Queue = await call(kabir, "GET", "/api/manage/requests");
  const r02Items = (
    (r02Queue.data.items ?? []) as {
      booking?: { id?: string; requesterId?: string };
      rank?: number;
      resource?: { id?: string };
    }[]
  ).filter((item) => item.resource?.id === "r02");
  const ananyaRank = r02Items.find(
    (item) => item.booking?.requesterId === "u-ananya",
  )?.rank;
  const sanaItem = r02Items.find((item) => item.booking?.requesterId === "u-sana");
  const sanaRank = sanaItem?.rank;
  record(
    "D11 FairShare ranks Ananya first",
    ananyaRank === 1 && sanaRank === 2,
    `entries=${r02Items.length} ananyaRank=${ananyaRank} sanaRank=${sanaRank}`,
  );

  if (sanaItem?.booking?.id) {
    const withoutOverride = await call(
      kabir,
      "POST",
      `/api/bookings/${sanaItem.booking.id}/approve`,
      {},
    );
    const withoutOverrideError = (withoutOverride.data.error ?? {}) as { code?: string };
    record(
      "D11 rank-2 approval needs override",
      withoutOverride.status === 422 && withoutOverrideError.code === "OVERRIDE_REQUIRED",
      `status=${withoutOverride.status} code=${withoutOverrideError.code}`,
    );

    const withOverride = await call(
      kabir,
      "POST",
      `/api/bookings/${sanaItem.booking.id}/approve`,
      {
        overrideReason: "Sana needs the kit for a verified field assignment this week.",
      },
    );
    const sanaApproved = (withOverride.data.booking ?? {}) as { status?: string };
    record(
      "D11 override approval succeeds",
      withOverride.status === 200 && sanaApproved.status === "APPROVED",
      `status=${withOverride.status} state=${sanaApproved.status}`,
    );

    const ananyaR02 = r02Items.find((item) => item.booking?.requesterId === "u-ananya");
    if (ananyaR02?.booking?.id) {
      const superseded = await call(
        ananya,
        "GET",
        `/api/bookings/${ananyaR02.booking.id}`,
      );
      const supersededView = superseded.data as {
        booking?: { status?: string };
        history?: { toStatus?: string; reasonCode?: string }[];
      };
      const systemReason = (supersededView.history ?? []).find(
        (entry) => entry.toStatus === "WAITLISTED",
      );
      record(
        "D11 competing request waitlisted",
        supersededView.booking?.status === "WAITLISTED" &&
          systemReason?.reasonCode === "SUPERSEDED_BY_APPROVED_BOOKING",
        `status=${superseded.status} state=${supersededView.booking?.status} reason=${systemReason?.reasonCode ?? "missing"}`,
      );
    }
  }

  // D12 - unauthorized access.
  const manage = await call(rohan, "GET", "/api/manage/requests");
  const admin = await call(rohan, "GET", "/api/admin/users");
  const foreignBooking = await call(rohan, "GET", "/api/bookings/b-pending-ananya-r02");
  const manageError = (manage.data.error ?? {}) as { code?: string };
  const adminError = (admin.data.error ?? {}) as { code?: string };
  const foreignError = (foreignBooking.data.error ?? {}) as { code?: string };
  record(
    "D12 owner/admin APIs blocked",
    manage.status === 403 &&
      manageError.code === "FORBIDDEN" &&
      admin.status === 403 &&
      adminError.code === "FORBIDDEN",
    `manage=${manage.status}/${manageError.code} admin=${admin.status}/${adminError.code}`,
  );
  record(
    "D12 foreign booking hidden",
    foreignBooking.status === 404 && foreignError.code === "NOT_FOUND",
    `status=${foreignBooking.status} code=${foreignError.code}`,
  );

  // D12 UI permission pages.
  const managePage = await fetch(`${BASE}/manage/requests`, {
    headers: { cookie: rohan },
    redirect: "manual",
  });
  const managePageHtml = await managePage.text();
  const managePageLocation = managePage.headers.get("location") ?? "";
  record(
    "D12 owner page denied for borrower",
    managePage.status === 403 ||
      managePageLocation.includes("/forbidden") ||
      managePageHtml.includes("/forbidden"),
    `status=${managePage.status} location=${managePageLocation || "none"} redirect=${managePageHtml.includes("/forbidden")}`,
  );

  // Keep the sessions tidy; the demo database is reset afterwards.
  for (const cookie of [meera, ananya, rohan, kabir, sana, dev]) {
    await fetch(`${BASE}/api/auth/sign-out`, { method: "POST", headers: { cookie } });
  }

  const failures = outcomes.filter((outcome) => !outcome.ok);
  fs.mkdirSync("docs/evidence", { recursive: true });
  fs.writeFileSync(
    EVIDENCE,
    [
      "# Demo run D1-D12",
      "",
      `Date: ${new Date().toISOString()}`,
      `Command: npx tsx scripts/demo-run.ts (base ${BASE})`,
      `Steps: ${outcomes.length}, passed: ${outcomes.length - failures.length}, failed: ${failures.length}`,
      "",
      "| Step | Status | Detail |",
      "| --- | --- | --- |",
      ...outcomes.map(
        (outcome) =>
          `| ${outcome.step} | ${outcome.ok ? "PASS" : "FAIL"} | ${outcome.detail.replace(/\|/g, "\\|")} |`,
      ),
      "",
      "D7-D9 ran on the auto-approve lavalier kit created in D1 because the seeded R01 booking occupies 16:30-20:30 IST today, outside the 30-minute checkout window.",
      "The demo database must be reset afterwards with: npm run demo:reset",
      "",
    ].join("\n"),
  );
  process.stdout.write(
    `\n${outcomes.length - failures.length}/${outcomes.length} demo steps passed. Log: ${EVIDENCE}\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
