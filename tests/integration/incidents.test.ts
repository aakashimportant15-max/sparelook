import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createIncidentForUser,
  incidentDetail,
  incidentListForUser,
  updateIncidentForUser,
} from "../../src/server/services/incidents";
import { getIncident } from "../../src/server/repos/incidents";
import { listAuditEvents } from "../../src/server/audit";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { appError, expectAppError, sessionUser } from "../helpers/fixtures";

const REQUEST = "req-inc";

describe("TC-INC: incident reporting and lifecycle", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-INC-01 a borrower can report an incident on their own booking", () => {
    const incident = createIncidentForUser(
      sessionUser("u-rohan"),
      {
        resourceId: "r01",
        bookingId: "b-approved-r01",
        type: "DAMAGE",
        severity: "MEDIUM",
        description: "Lens has a scratch on the front element.",
      },
      REQUEST,
    );
    expect(incident).toMatchObject({
      resourceId: "r01",
      bookingId: "b-approved-r01",
      reporterId: "u-rohan",
      status: "OPEN",
      type: "DAMAGE",
    });
    expect(incident.description).toContain("scratch");
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "incident.created",
      }).some((event) => event.entityId === incident.id),
    ).toBe(true);
  });

  it("TC-INC-02 incident reports validate length and booking ownership", () => {
    const short = appError(() =>
      createIncidentForUser(
        sessionUser("u-rohan"),
        {
          resourceId: "r01",
          bookingId: "b-approved-r01",
          type: "OTHER",
          severity: "LOW",
          description: "bad",
        },
        REQUEST,
      ),
    );
    expect(short.code).toBe("VALIDATION_FAILED");
    expect((short.fields as { code: string }[])[0].code).toBe("INVALID_LENGTH");

    expectAppError(
      () =>
        createIncidentForUser(
          sessionUser("u-rohan"),
          {
            resourceId: "r02",
            bookingId: "b-approved-r01",
            type: "OTHER",
            severity: "LOW",
            description: "Mismatched resource and booking references.",
          },
          REQUEST,
        ),
      "NOT_FOUND",
    );
  });

  it("TC-INC-03 borrowers cannot report unrelated incidents, owners can manage theirs", () => {
    expectAppError(
      () =>
        createIncidentForUser(
          sessionUser("u-dev"),
          {
            resourceId: "r01",
            type: "OTHER",
            severity: "LOW",
            description: "I do not have a booking for this resource.",
          },
          REQUEST,
        ),
      "NOT_FOUND",
    );
    const ownerIncident = createIncidentForUser(
      sessionUser("u-kabir"),
      {
        resourceId: "r01",
        type: "OTHER",
        severity: "LOW",
        description: "Owner note: inspection due next month.",
      },
      REQUEST,
    );
    expect(ownerIncident.reporterId).toBe("u-kabir");
  });

  it("TC-INC-04 incident state changes require valid transitions and a resolution note", () => {
    const admin = sessionUser("u-meera");
    const created = createIncidentForUser(
      sessionUser("u-kabir"),
      {
        resourceId: "r01",
        type: "DAMAGE",
        severity: "HIGH",
        description: "Cracked filter thread found during inspection.",
      },
      REQUEST,
    );
    expectAppError(
      () => updateIncidentForUser(admin, created.id, "RESOLVED", "Fixed", REQUEST),
      "INVALID_TRANSITION",
    );
    const investigating = updateIncidentForUser(
      admin,
      created.id,
      "INVESTIGATING",
      undefined,
      REQUEST,
    );
    expect(investigating.status).toBe("INVESTIGATING");
    expectAppError(
      () => updateIncidentForUser(admin, created.id, "RESOLVED", undefined, REQUEST),
      "VALIDATION_FAILED",
    );
    const resolved = updateIncidentForUser(
      admin,
      created.id,
      "RESOLVED",
      "Filter replaced by vendor",
      REQUEST,
    );
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolutionNote).toBe("Filter replaced by vendor");
    expect(resolved.resolvedBy).toBe("u-meera");
    expect(resolved.resolvedAt).toBeTruthy();
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "incident.resolved",
      }).some((event) => event.entityId === created.id),
    ).toBe(true);
    expectAppError(
      () => updateIncidentForUser(admin, created.id, "INVESTIGATING", undefined, REQUEST),
      "INVALID_TRANSITION",
    );
  });

  it("TC-INC-05 repeating the current status is rejected", () => {
    expectAppError(
      () =>
        updateIncidentForUser(
          sessionUser("u-meera"),
          "inc-hist-1",
          "RESOLVED",
          "Still resolved",
          REQUEST,
        ),
      "INVALID_TRANSITION",
    );
  });

  it("TC-INC-06 only administrators may reopen a resolved incident", () => {
    expectAppError(
      () =>
        updateIncidentForUser(
          sessionUser("u-kabir"),
          "inc-hist-1",
          "OPEN",
          undefined,
          REQUEST,
        ),
      "FORBIDDEN",
    );
    const reopened = updateIncidentForUser(
      sessionUser("u-meera"),
      "inc-hist-1",
      "OPEN",
      undefined,
      REQUEST,
    );
    expect(reopened.status).toBe("OPEN");
    expect(reopened.resolutionNote).toBeNull();
    expect(reopened.resolvedBy).toBeNull();
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "incident.open",
      }).some((event) => event.entityId === "inc-hist-1"),
    ).toBe(true);
  });

  it("TC-INC-07 only managers can change incident status", () => {
    const incident = createIncidentForUser(
      sessionUser("u-rohan"),
      {
        resourceId: "r01",
        bookingId: "b-approved-r01",
        type: "CONDITION_DISPUTE",
        severity: "LOW",
        description: "Minor wear was already present at pickup.",
      },
      REQUEST,
    );
    // Deliberately reported as NOT_FOUND so members cannot probe for incidents.
    expectAppError(
      () =>
        updateIncidentForUser(
          sessionUser("u-rohan"),
          incident.id,
          "INVESTIGATING",
          undefined,
          REQUEST,
        ),
      "NOT_FOUND",
    );
    const detail = incidentDetail(sessionUser("u-rohan"), incident.id);
    expect(detail.canManage).toBe(false);
    expect(detail.canReopen).toBe(false);
  });

  it("TC-INC-08 incident lists are scoped by role and support filters", () => {
    const adminList = incidentListForUser(sessionUser("u-meera"), {});
    expect(adminList.map((incident) => incident.id)).toContain("inc-hist-1");
    expect(incidentListForUser(sessionUser("u-dev"), {})).toEqual([]);
    const rohanList = incidentListForUser(sessionUser("u-rohan"), {});
    expect(rohanList.map((incident) => incident.id)).toContain("inc-hist-1");
    const resolved = incidentListForUser(sessionUser("u-meera"), { status: "RESOLVED" });
    expect(resolved.every((incident) => incident.status === "RESOLVED")).toBe(true);
    expect(incidentListForUser(sessionUser("u-meera"), { severity: "LOW" })).toEqual([]);
  });

  it("TC-INC-09 missing incidents return 404", () => {
    expectAppError(
      () =>
        updateIncidentForUser(
          sessionUser("u-meera"),
          "inc-does-not-exist",
          "OPEN",
          undefined,
          REQUEST,
        ),
      "NOT_FOUND",
    );
    expectAppError(
      () => incidentDetail(sessionUser("u-meera"), "inc-does-not-exist"),
      "NOT_FOUND",
    );
  });

  it("TC-INC-10 seeded incident stays resolved and linked to its booking", () => {
    const incident = getIncident(DEMO_INSTITUTION_ID, "inc-hist-1");
    expect(incident).toMatchObject({
      type: "MISSING_ITEM",
      severity: "MEDIUM",
      status: "RESOLVED",
      bookingId: "b-hist-2",
      resourceId: "r01",
    });
    expect(incident?.resolutionNote).toContain("Battery");
  });

  it("TC-INC-11 managers see the real status history; reporters do not", () => {
    const incident = createIncidentForUser(
      sessionUser("u-rohan"),
      {
        resourceId: "r01",
        bookingId: "b-approved-r01",
        type: "OTHER",
        severity: "LOW",
        description: "Battery door feels loose during handling.",
      },
      REQUEST,
    );
    updateIncidentForUser(
      sessionUser("u-kabir"),
      incident.id,
      "INVESTIGATING",
      undefined,
      REQUEST,
    );
    updateIncidentForUser(
      sessionUser("u-kabir"),
      incident.id,
      "RESOLVED",
      "Door checked and tightened by the lab technician.",
      REQUEST,
    );

    const ownerView = incidentDetail(sessionUser("u-kabir"), incident.id);
    expect(ownerView.canManage).toBe(true);
    expect(ownerView.history.map((entry) => entry.action)).toEqual([
      "incident.created",
      "incident.investigating",
      "incident.resolved",
    ]);
    expect(ownerView.history[0].actorName).toBe("Rohan Mehta");
    expect(ownerView.history.at(-1)?.actorName).toBe("Dr. Kabir Rao");
    expect(ownerView.history.at(-1)?.to).toBe("RESOLVED");
    expect(ownerView.incident.resolutionNote).toContain("tightened");

    // Reporters keep the user-facing status view without the staff audit trail.
    const reporterView = incidentDetail(sessionUser("u-rohan"), incident.id);
    expect(reporterView.canManage).toBe(false);
    expect(reporterView.history).toEqual([]);

    const adminView = incidentDetail(sessionUser("u-meera"), incident.id);
    expect(adminView.history).toHaveLength(3);
  });
});
