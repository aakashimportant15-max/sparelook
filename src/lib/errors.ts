export type ErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_ELIGIBLE"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BOOKING_CONFLICT"
  | "INVALID_TRANSITION"
  | "RESOURCE_UNAVAILABLE"
  | "OVERRIDE_REQUIRED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type FieldError = { field: string; code: string; message: string };

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldError[];
  readonly extra?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    fields?: FieldError[],
    extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fields = fields;
    this.extra = extra;
  }
}

export const errors = {
  unauthenticated: () =>
    new AppError("UNAUTHENTICATED", "Please sign in to continue.", 401),
  forbidden: (message = "You do not have access to perform this action.") =>
    new AppError("FORBIDDEN", message, 403),
  notFound: (message = "We could not find that.") =>
    new AppError("NOT_FOUND", message, 404),
  validation: (fields: FieldError[], message = "Please fix the highlighted fields.") =>
    new AppError("VALIDATION_FAILED", message, 422, fields),
  notEligible: (reasons: { code: string; message: string }[]) =>
    new AppError(
      "NOT_ELIGIBLE",
      "You are not eligible to book this resource.",
      422,
      reasons.map((r) => ({ field: "eligibility", code: r.code, message: r.message })),
      { reasons },
    ),
  resourceUnavailable: (message = "This resource is not available for booking.") =>
    new AppError("RESOURCE_UNAVAILABLE", message, 422),
  bookingConflict: (
    message = "That time slot is already booked.",
    extra?: Record<string, unknown>,
  ) => new AppError("BOOKING_CONFLICT", message, 409, undefined, extra),
  invalidTransition: (from: string, to: string) =>
    new AppError("INVALID_TRANSITION", `Booking cannot move from ${from} to ${to}.`, 409),
  overrideRequired: () =>
    new AppError(
      "OVERRIDE_REQUIRED",
      "This request is not ranked first. An override reason is required.",
      422,
    ),
  rateLimited: () =>
    new AppError("RATE_LIMITED", "Too many attempts. Please wait and try again.", 429),
  internal: () =>
    new AppError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500),
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
