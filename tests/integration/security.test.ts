import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { approveBooking, checkoutBooking } from "../../src/server/services/bookings";
import { bookingDetail } from "../../src/server/services/bookings";
import {
  listCatalogue,
  updateResourceForUser,
  visibleResource,
} from "../../src/server/services/resources";
import { incidentDetail } from "../../src/server/services/incidents";
import { createResourceForAdmin } from "../../src/server/services/resources";
import { canApproveBooking, canViewAudit, canViewBooking } from "../../src/server/authz";
import { listAuditEvents } from "../../src/server/audit";
import { getBooking } from "../../src/server/repos/bookings";
import { getResourceById } from "../../src/server/repos/resources";
import { DEMO_INSTITUTION_ID, TEST_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { appError, expectAppError, seedResource, sessionUser } from "../helpers/fixtures";

describe("TC-SEC: authorization, tenant isolation and audit of denials", () => {
  beforeEach(() => resetDatabase({ includeSecondInstitution: true }));
  afterAll(() => teardownDatabase());

  it("TC-SEC-01 isolates institutions in repositories, catalogue and visibility checks", () => {
    const lakeAdmin = sessionUser("u-lake-admin");
    expect(lakeAdmin.institutionId).toBe(TEST_INSTITUTION_ID);
    expect(getResourceById(TEST_INSTITUTION_ID, "r01")).toBeNull();
    expect(getResourceById(DEMO_INSTITUTION_ID, "r-lake-1")).toBeNull();
    expect(getBooking(TEST_INSTITUTION_ID, "b-approved-r01")).toBeNull();
    expect(() => visibleResource(lakeAdmin, "r01")).toThrow();
    const lakeCatalogue = listCatalogue(lakeAdmin, {});
    expect(lakeCatalogue.total).toBe(1);
    expect(lakeCatalogue.items.map((item) => item.id)).toEqual(["r-lake-1"]);
  });

  it("TC-SEC-02 unauthenticated access has no session to resolve", async () => {
    const { getSessionUser } = await import("../../src/server/auth");
    expect(getSessionUser(undefined)).toBeNull();
    expect(getSessionUser("")).toBeNull();
    expect(getSessionUser("forged-token")).toBeNull();
  });

  it("TC-SEC-03 borrowers cannot approve, reject, check out or return equipment", () => {
    const ananya = sessionUser("u-ananya");
    expectAppError(
      () => approveBooking(ananya, "b-pending-sana-r02", "irrelevant", "req-sec"),
      "FORBIDDEN",
    );
    expectAppError(
      () =>
        checkoutBooking(
          ananya,
          "b-approved-r01",
          {
            overallCondition: "GOOD",
            checklist: {},
          },
          "req-sec",
        ),
      "FORBIDDEN",
    );
  });

  it("TC-SEC-04 borrowers cannot read someone else's booking and receive a 404", () => {
    const ananya = sessionUser("u-ananya");
    expectAppError(() => bookingDetail(ananya, "b-pending-sana-r02"), "NOT_FOUND");
    expectAppError(
      () => bookingDetail(sessionUser("u-dev"), "b-approved-r01"),
      "NOT_FOUND",
    );
  });

  it("TC-SEC-05 incident details are limited to reporters, borrowers and the resource owner", () => {
    expectAppError(() => incidentDetail(sessionUser("u-dev"), "inc-hist-1"), "NOT_FOUND");
    expect(incidentDetail(sessionUser("u-kabir"), "inc-hist-1").canManage).toBe(true);
    expect(incidentDetail(sessionUser("u-meera"), "inc-hist-1").canReopen).toBe(true);
  });

  it("TC-SEC-06 owners cannot manage another owner's resource or create catalogue items", () => {
    const kabir = sessionUser("u-kabir");
    expectAppError(
      () => updateResourceForUser(kabir, "r08", { name: "Hijacked" }, "req-sec"),
      "NOT_FOUND",
    );
    const denied = listAuditEvents({
      institutionId: DEMO_INSTITUTION_ID,
      outcome: "DENIED",
    });
    expect(denied.some((event) => event.action === "resource.update.denied")).toBe(true);
    expectAppError(
      () =>
        createResourceForAdmin(
          kabir,
          {
            name: "Unauthorised",
            type: "CAMERA",
            assetTag: "RB-X-999",
            location: "Nowhere",
            description: "Should not exist",
            accessories: [],
            maxDurationHours: 4,
            approvalRequired: false,
            openTime: null,
            closeTime: null,
            allowedGroups: [],
            requiredTrainings: [],
            ownerId: "u-kabir",
          },
          "req-sec",
        ),
      "FORBIDDEN",
    );
    expect(getResourceById(DEMO_INSTITUTION_ID, "r08")?.name).toBe(
      "Digital Oscilloscope",
    );
  });

  it("TC-SEC-07 owners cannot change administrator-only resource fields", () => {
    const kabir = sessionUser("u-kabir");
    const updated = updateResourceForUser(
      kabir,
      "r01",
      {
        name: "Mirrorless Camera Kit A (renamed)",
        maxDurationHours: 1,
        ownerId: "u-nikhil",
        approvalRequired: false,
      },
      "req-sec",
    );
    expect(updated.name).toBe("Mirrorless Camera Kit A (renamed)");
    expect(updated.maxDurationHours).toBe(48);
    expect(updated.ownerId).toBe("u-kabir");
    expect(updated.approvalRequired).toBe(true);
  });

  it("TC-SEC-08 hidden resources are invisible to borrowers but visible to admins", () => {
    const borrower = sessionUser("u-ananya");
    const admin = sessionUser("u-meera");
    expectAppError(() => visibleResource(borrower, "r10"), "NOT_FOUND");
    expect(visibleResource(admin, "r10").status).toBe("ARCHIVED");
    const adminCatalogue = listCatalogue(admin, {});
    expect(adminCatalogue.items.map((item) => item.id)).toContain("r10");
    expect(listCatalogue(borrower, {}).items.map((item) => item.id)).not.toContain("r10");
  });

  it("TC-SEC-09 denial is audited with the actor and request id", () => {
    const error = appError(() =>
      approveBooking(
        sessionUser("u-ananya"),
        "b-pending-sana-r02",
        "reason",
        "req-audit-denial",
      ),
    );
    expect(error.code).toBe("FORBIDDEN");
    const events = listAuditEvents({
      institutionId: DEMO_INSTITUTION_ID,
      action: "booking.approve.denied",
      outcome: "DENIED",
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({
      actorId: "u-ananya",
      entityId: "b-pending-sana-r02",
      requestId: "req-audit-denial",
      outcome: "DENIED",
    });
  });

  it("TC-SEC-10 approval and audit permissions stay role-scoped", () => {
    const kabir = sessionUser("u-kabir");
    const rohan = sessionUser("u-rohan");
    expect(
      canApproveBooking(
        kabir,
        { requesterId: "u-rohan" },
        { id: "r01", ownerId: "u-kabir" },
      ),
    ).toBe(true);
    expect(
      canApproveBooking(
        rohan,
        { requesterId: "u-rohan" },
        { id: "r01", ownerId: "u-kabir" },
      ),
    ).toBe(false);
    expect(
      canViewBooking(
        rohan,
        { requesterId: "u-rohan" },
        { id: "r01", ownerId: "u-kabir" },
      ),
    ).toBe(true);
    expect(
      canViewBooking(
        sessionUser("u-sana"),
        { requesterId: "u-rohan" },
        { id: "r01", ownerId: "u-kabir" },
      ),
    ).toBe(false);
    expect(canViewAudit(rohan)).toBe(false);
    expect(canViewAudit(kabir)).toBe(true);
    expect(canViewAudit(sessionUser("u-meera"))).toBe(true);
  });

  it("TC-SEC-11 resource ownership cannot be spoofed when creating an incident", () => {
    expect(seedResource("r01").ownerId).toBe("u-kabir");
    expectAppError(
      () =>
        checkoutBooking(
          sessionUser("u-nikhil"),
          "b-approved-r01",
          { overallCondition: "GOOD", checklist: {} },
          "req-sec",
        ),
      "FORBIDDEN",
    );
  });
});
