import { errors } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { addDays, formatDateTime } from "../../lib/time";
import type { Resource, ResourceStatus, SessionUser } from "../../domain/types";
import { canManageResource, deny, isAdmin } from "../authz";
import { writeAudit } from "../audit";
import {
  busyBlocks,
  createResource,
  getResourceById,
  listResources,
  setResourceStatus,
  updateResource,
  type ResourceInput,
} from "../repos/resources";
import { futureApprovedForResource } from "../repos/bookings";
import { evaluateEligibility } from "./eligibility";

export type CatalogueItem = Resource & {
  eligible: boolean;
  eligibilityHint: string;
  nextFree: string;
};

export type CatalogueParams = {
  q?: string;
  type?: string;
  location?: string;
  eligibleOnly?: boolean;
  page?: number;
  pageSize?: number;
};

function nextFreeHint(resource: Resource, now: Date, timeZone: string): string {
  const blocks = busyBlocks(
    resource.id,
    now.toISOString(),
    addDays(now, 30).toISOString(),
  );
  let cursor = now;
  for (const block of blocks) {
    const start = new Date(block.startAt);
    const end = new Date(block.endAt);
    if (cursor.getTime() < end.getTime() && start.getTime() <= cursor.getTime()) {
      cursor = end;
    }
  }
  return `Free from ${formatDateTime(cursor, timeZone)}`;
}

export function listCatalogue(
  user: SessionUser,
  params: CatalogueParams,
): { items: CatalogueItem[]; total: number; page: number; pageSize: number } {
  const pageSize = Math.min(Math.max(params.pageSize ?? 12, 1), 48);
  const page = Math.max(params.page ?? 1, 1);
  const result = listResources({
    institutionId: user.institutionId,
    q: params.q,
    type: params.type,
    location: params.location,
    includeHidden: user.role === "ADMIN",
    limit: params.eligibleOnly ? 200 : pageSize,
    offset: params.eligibleOnly ? 0 : (page - 1) * pageSize,
  });

  const items = result.items.map((resource) => {
    const eligibility = evaluateEligibility(user, resource);
    return {
      ...resource,
      eligible: eligibility.eligible,
      eligibilityHint: eligibility.eligible
        ? "You are eligible to request this"
        : (eligibility.reasons[0]?.message ?? "Not eligible"),
      nextFree: nextFreeHint(resource, new Date(), user.timezone),
    };
  });

  if (params.eligibleOnly) {
    const filtered = items.filter((item) => item.eligible);
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }
  return { items, total: result.total, page, pageSize };
}

export function visibleResource(user: SessionUser, resourceId: string): Resource {
  const resource = getResourceById(user.institutionId, resourceId);
  if (!resource) throw errors.notFound();
  if (
    (resource.status === "DISABLED" || resource.status === "ARCHIVED") &&
    !isAdmin(user) &&
    !(user.role === "OWNER" && resource.ownerId === user.id)
  ) {
    throw errors.notFound();
  }
  return resource;
}

export type ResourceFormInput = ResourceInput;

export function createResourceForAdmin(
  user: SessionUser,
  input: ResourceInput,
  requestId: string,
): Resource {
  if (!isAdmin(user)) deny(user, "resource.create", "resource", null, requestId);
  if (input.openTime && input.closeTime && input.openTime >= input.closeTime) {
    throw errors.validation([
      {
        field: "closeTime",
        code: "INVALID_OPEN_HOURS",
        message: "Closing time must be after opening time.",
      },
    ]);
  }
  let created: Resource;
  try {
    created = createResource(user.institutionId, input);
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw errors.validation([
        {
          field: "assetTag",
          code: "DUPLICATE_ASSET_TAG",
          message: "That asset tag is already in use.",
        },
      ]);
    }
    throw error;
  }
  writeAudit({
    institutionId: user.institutionId,
    actorId: user.id,
    action: "resource.created",
    entityType: "resource",
    entityId: created.id,
    metadata: { name: created.name, status: created.status },
    requestId,
  });
  return created;
}

export function updateResourceForUser(
  user: SessionUser,
  resourceId: string,
  input: Partial<ResourceInput>,
  requestId: string,
): Resource {
  const resource = getResourceById(user.institutionId, resourceId);
  if (!resource) throw errors.notFound();
  if (!canManageResource(user, resource)) {
    deny(user, "resource.update", "resource", resourceId, requestId, "NOT_FOUND");
  }
  const adminFields: (keyof ResourceInput)[] = [
    "ownerId",
    "maxDurationHours",
    "approvalRequired",
    "openTime",
    "closeTime",
    "allowedGroups",
    "requiredTrainings",
    "type",
    "assetTag",
  ];
  const sanitized: Partial<ResourceInput> = { ...input };
  if (!isAdmin(user)) {
    for (const field of adminFields) delete sanitized[field];
  }
  let updated: Resource;
  try {
    updated = updateResource(user.institutionId, resourceId, sanitized);
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw errors.validation([
        {
          field: "assetTag",
          code: "DUPLICATE_ASSET_TAG",
          message: "That asset tag is already in use.",
        },
      ]);
    }
    throw error;
  }
  writeAudit({
    institutionId: user.institutionId,
    actorId: user.id,
    action: "resource.updated",
    entityType: "resource",
    entityId: resourceId,
    metadata: { fields: Object.keys(sanitized) },
    requestId,
  });
  return updated;
}

export function changeResourceStatus(
  user: SessionUser,
  resourceId: string,
  status: ResourceStatus,
  requestId: string,
): {
  resource: Resource;
  affectedBookings: { id: string; startAt: string; endAt: string }[];
} {
  const resource = getResourceById(user.institutionId, resourceId);
  if (!resource) throw errors.notFound();
  if (!canManageResource(user, resource)) {
    deny(user, "resource.status", "resource", resourceId, requestId, "NOT_FOUND");
  }
  const updated = setResourceStatus(user.institutionId, resourceId, status);
  const affected = futureApprovedForResource(resourceId, new Date().toISOString());
  writeAudit({
    institutionId: user.institutionId,
    actorId: user.id,
    action: "resource.status_changed",
    entityType: "resource",
    entityId: resourceId,
    metadata: { from: resource.status, to: status, affectedBookings: affected.length },
    requestId,
  });
  if (affected.length > 0) {
    logger.warn("Resource status changed with future bookings", {
      resourceId,
      affected: affected.length,
    });
  }
  return {
    resource: updated,
    affectedBookings: affected.map((b) => ({
      id: b.id,
      startAt: b.startAt,
      endAt: b.endAt,
    })),
  };
}

export function resourceDetail(user: SessionUser, resourceId: string) {
  const resource = visibleResource(user, resourceId);
  const now = new Date();
  const availability = busyBlocks(
    resource.id,
    now.toISOString(),
    addDays(now, 30).toISOString(),
  );
  const eligibility = evaluateEligibility(user, resource);
  return { resource, availability, eligibility };
}
