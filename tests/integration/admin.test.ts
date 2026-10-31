import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  changeResourceStatus,
  createResourceForAdmin,
  listCatalogue,
  updateResourceForUser,
} from "../../src/server/services/resources";
import { listAuditEvents } from "../../src/server/audit";
import { DEMO_INSTITUTION_ID } from "../../src/db/seed-data";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { appError, expectAppError, sessionUser } from "../helpers/fixtures";

const REQUEST = "req-admin";

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: "Studio Softbox Pair",
    type: "LIGHTING",
    assetTag: "RB-LGT-011",
    location: "Media Lab, Room 204",
    description: "Two softboxes with stands for studio interviews.",
    accessories: ["2 softboxes", "Stands", "Power cables"],
    maxDurationHours: 48,
    approvalRequired: true,
    openTime: "08:00",
    closeTime: "20:00",
    allowedGroups: ["media-club"],
    requiredTrainings: [],
    ownerId: "u-kabir",
    ...overrides,
  };
}

describe("TC-ADM: resource administration", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-ADM-01 administrators create catalogue resources with an audit trail", () => {
    const created = createResourceForAdmin(sessionUser("u-meera"), input(), REQUEST);
    expect(created).toMatchObject({
      name: "Studio Softbox Pair",
      status: "ACTIVE",
      category: "cameras_technical",
      approvalRequired: true,
      ownerId: "u-kabir",
    });
    expect(created.accessories).toHaveLength(3);
    expect(created.allowedGroups).toEqual(["media-club"]);
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "resource.created",
      }).some((event) => event.entityId === created.id && event.actorId === "u-meera"),
    ).toBe(true);
    expect(listCatalogue(sessionUser("u-ananya"), { q: "softbox" }).total).toBe(1);
  });

  it("TC-ADM-02 duplicate asset tags and invalid opening hours are rejected", () => {
    const duplicate = appError(() =>
      createResourceForAdmin(
        sessionUser("u-meera"),
        input({ assetTag: "RB-CAM-001" }),
        REQUEST,
      ),
    );
    expect(duplicate.code).toBe("VALIDATION_FAILED");
    expect((duplicate.fields as { code: string }[])[0].code).toBe("DUPLICATE_ASSET_TAG");

    const hours = appError(() =>
      createResourceForAdmin(
        sessionUser("u-meera"),
        input({ assetTag: "RB-LGT-012", openTime: "20:00", closeTime: "08:00" }),
        REQUEST,
      ),
    );
    expect(hours.code).toBe("VALIDATION_FAILED");
    expect((hours.fields as { code: string }[])[0].code).toBe("INVALID_OPEN_HOURS");
  });

  it("TC-ADM-03 non-administrators cannot create resources", () => {
    expectAppError(
      () =>
        createResourceForAdmin(
          sessionUser("u-kabir"),
          input({ assetTag: "RB-LGT-013" }),
          REQUEST,
        ),
      "FORBIDDEN",
    );
    expect(listCatalogue(sessionUser("u-meera"), {}).total).toBe(10);
  });

  it("TC-ADM-04 owners edit their own resource but administrators may edit any resource", () => {
    const ownerEdit = updateResourceForUser(
      sessionUser("u-kabir"),
      "r01",
      { description: "Updated description for the media club." },
      REQUEST,
    );
    expect(ownerEdit.description).toContain("Updated description");
    const adminEdit = updateResourceForUser(
      sessionUser("u-meera"),
      "r08",
      { location: "Electronics Lab, Room 112" },
      REQUEST,
    );
    expect(adminEdit.location).toContain("112");
    const audit = listAuditEvents({
      institutionId: DEMO_INSTITUTION_ID,
      action: "resource.updated",
    });
    expect(audit.length).toBe(2);
  });

  it("TC-ADM-05 disabling a resource hides it from borrowers and reports affected bookings", () => {
    const result = changeResourceStatus(
      sessionUser("u-kabir"),
      "r01",
      "DISABLED",
      REQUEST,
    );
    expect(result.resource.status).toBe("DISABLED");
    expect(result.affectedBookings.map((booking) => booking.id)).toContain(
      "b-approved-r01",
    );
    expectAppError(
      () => changeResourceStatus(sessionUser("u-kabir"), "r08", "DISABLED", REQUEST),
      "NOT_FOUND",
    );
    const adminCatalogue = listCatalogue(sessionUser("u-meera"), {});
    const disabled = adminCatalogue.items.find((item) => item.id === "r01");
    expect(disabled?.status).toBe("DISABLED");
    const borrowerCatalogue = listCatalogue(sessionUser("u-ananya"), {});
    expect(borrowerCatalogue.items.find((item) => item.id === "r01")).toBeUndefined();
  });

  it("TC-ADM-06 maintenance resources can be set back to active", () => {
    const restored = changeResourceStatus(
      sessionUser("u-nikhil"),
      "r09",
      "ACTIVE",
      REQUEST,
    );
    expect(restored.resource.status).toBe("ACTIVE");
    expect(
      listAuditEvents({
        institutionId: DEMO_INSTITUTION_ID,
        action: "resource.status_changed",
      })[0].metadata,
    ).toMatchObject({ from: "MAINTENANCE", to: "ACTIVE" });
  });

  it("TC-ADM-07 administrators can reassign ownership of a resource", () => {
    const updated = updateResourceForUser(
      sessionUser("u-meera"),
      "r06",
      { ownerId: "u-nikhil", approvalRequired: false },
      REQUEST,
    );
    expect(updated.ownerId).toBe("u-nikhil");
    expect(updated.approvalRequired).toBe(false);
  });
});
