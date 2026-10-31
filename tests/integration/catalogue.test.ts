import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listCatalogue, resourceDetail } from "../../src/server/services/resources";
import { resetDatabase, teardownDatabase } from "../helpers/db";
import { expectAppError, sessionUser } from "../helpers/fixtures";

describe("TC-CAT: catalogue, filters and eligibility hints", () => {
  beforeEach(() => resetDatabase());
  afterAll(() => teardownDatabase());

  it("TC-CAT-01 lists active and maintenance resources, hiding archived ones", () => {
    const result = listCatalogue(sessionUser("u-ananya"), {});
    expect(result.total).toBe(9);
    const ids = result.items.map((item) => item.id);
    expect(ids).toContain("r09");
    expect(ids).not.toContain("r10");
    expect(result.items.every((item) => item.nextFree.startsWith("Free from "))).toBe(
      true,
    );
  });

  it("TC-CAT-02 gives each member an eligibility hint", () => {
    const items = listCatalogue(sessionUser("u-ananya"), {}).items;
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get("r01")?.eligible).toBe(true);
    expect(byId.get("r04")?.eligible).toBe(false);
    expect(byId.get("r04")?.eligibilityHint).toMatch(/drone/i);
    expect(byId.get("r08")?.eligibilityHint).toMatch(/ECE|group|limited/i);
    expect(byId.get("r09")?.eligibilityHint).toMatch(/maintenance/i);
  });

  it("TC-CAT-03 filters eligible-only, search, type and location", () => {
    const ananya = sessionUser("u-ananya");
    const eligible = listCatalogue(ananya, { eligibleOnly: true });
    expect(eligible.items.map((item) => item.id).sort()).toEqual([
      "r01",
      "r02",
      "r05",
      "r06",
      "r07",
    ]);

    expect(listCatalogue(ananya, { q: "drone" }).items.map((item) => item.id)).toEqual([
      "r04",
    ]);
    expect(
      listCatalogue(ananya, { type: "CAMERA" }).items.map((item) => item.id),
    ).toEqual(["r04", "r03", "r01", "r02"]);
    expect(
      listCatalogue(ananya, { location: "electronics" })
        .items.map((item) => item.id)
        .sort(),
    ).toEqual(["r08", "r09"]);
  });

  it("TC-CAT-04 search terms are parameterised, so SQL fragments match nothing", () => {
    const result = listCatalogue(sessionUser("u-meera"), { q: "' OR 1=1 --" });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it("TC-CAT-05 paginates without duplicating results", () => {
    const first = listCatalogue(sessionUser("u-ananya"), { page: 1, pageSize: 4 });
    const second = listCatalogue(sessionUser("u-ananya"), { page: 2, pageSize: 4 });
    expect(first.total).toBe(9);
    expect(first.items).toHaveLength(4);
    expect(second.items).toHaveLength(4);
    const ids = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(ids.size).toBe(8);
  });

  it("TC-CAT-06 resource detail exposes availability and eligibility, and hides archived items", () => {
    const detail = resourceDetail(sessionUser("u-kabir"), "r01");
    expect(detail.availability.length).toBe(1);
    expect(detail.eligibility.eligible).toBe(false);
    expect(detail.eligibility.reasons.map((reason) => reason.code)).toContain(
      "SELF_BOOKING",
    );
    expectAppError(() => resourceDetail(sessionUser("u-ananya"), "r10"), "NOT_FOUND");
  });
});
