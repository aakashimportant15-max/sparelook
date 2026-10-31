import { z } from "zod";
import { errors, type FieldError } from "./errors";

export function parseSchema<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "body",
      code: issue.code.toUpperCase(),
      message: issue.message,
    }));
    throw errors.validation(fields);
  }
  return result.data;
}

export const signInSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password.").max(200),
  })
  .strict();

export const bookingCreateSchema = z
  .object({
    resourceId: z.string().min(1),
    startAt: z.string().min(1, "Choose a start time."),
    endAt: z.string().min(1, "Choose an end time."),
    purpose: z.string().trim().min(3, "Describe the purpose.").max(300),
    joinWaitlist: z.boolean().optional().default(false),
  })
  .strict();

export const reasonSchema = z
  .object({
    reason: z.string().max(300).optional(),
  })
  .strict();

export const overrideSchema = z
  .object({
    overrideReason: z.string().max(300).optional(),
  })
  .strict();

export const conditionSchema = z
  .object({
    overallCondition: z.enum(["GOOD", "MINOR_WEAR", "DAMAGED", "NOT_WORKING"], {
      message: "Choose an overall condition.",
    }),
    checklist: z.record(z.string(), z.enum(["PRESENT", "MISSING"])),
    notes: z.string().max(1000).optional().default(""),
  })
  .strict();

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const resourceSchema = z
  .object({
    name: z.string().trim().min(3).max(100),
    type: z.enum(["CAMERA", "AUDIO", "LIGHTING", "TEST_EQUIPMENT", "ACCESSORY"]),
    assetTag: z.string().trim().min(3).max(40),
    location: z.string().trim().min(2).max(120),
    description: z.string().trim().min(10).max(2000),
    accessories: z.array(z.string().trim().min(1).max(60)).max(50),
    maxDurationHours: z.coerce.number().int().min(1).max(720),
    approvalRequired: z.boolean(),
    openTime: z.string().regex(timePattern).nullable(),
    closeTime: z.string().regex(timePattern).nullable(),
    allowedGroups: z.array(z.string().trim().min(1).max(40)).max(20),
    requiredTrainings: z.array(z.string().trim().min(1).max(40)).max(20),
    ownerId: z.string().min(1),
  })
  .strict();

export const resourcePatchSchema = resourceSchema.partial().strict();

export const resourceStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "MAINTENANCE", "DISABLED", "ARCHIVED"]),
    reason: z.string().max(300).optional(),
  })
  .strict();

export const incidentCreateSchema = z
  .object({
    resourceId: z.string().min(1),
    bookingId: z.string().min(1).nullable().optional(),
    type: z.enum(["DAMAGE", "MISSING_ITEM", "LATE_RETURN", "CONDITION_DISPUTE", "OTHER"]),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    description: z.string().trim().min(10).max(2000),
  })
  .strict();

export const incidentUpdateSchema = z
  .object({
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "DISMISSED"]),
    resolutionNote: z.string().max(1000).optional(),
  })
  .strict();

export const tagsSchema = z
  .object({
    groups: z.array(z.string().trim().min(1).max(40)).max(20),
    trainings: z.array(z.string().trim().min(1).max(40)).max(20),
  })
  .strict();

export const userStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
  })
  .strict();
