import { cookies } from "next/headers";
import { getConfig } from "./config";
import { AppError, errors, isAppError } from "./errors";
import { logger } from "./logger";
import { SESSION_COOKIE, getSessionUser } from "../server/auth";
import { writeAudit } from "../server/audit";
import type { Role, SessionUser } from "../domain/types";
import { randomUUID } from "node:crypto";

export type ApiContext = {
  request: Request;
  requestId: string;
  user: SessionUser;
  params: Record<string, string>;
};

export type PublicApiContext = {
  request: Request;
  requestId: string;
  user: SessionUser | null;
  params: Record<string, string>;
};

export function json(data: unknown, status = 200, requestId?: string): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  if (requestId) headers.set("x-request-id", requestId);
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(error: unknown, requestId: string): Response {
  if (isAppError(error)) {
    const body: Record<string, unknown> = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
        ...(error.extra ? { details: error.extra } : {}),
        requestId,
      },
    };
    return json(body, error.status, requestId);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (
    message.includes("BOOKING_CONFLICT") ||
    message.includes("SQLITE_CONSTRAINT_TRIGGER")
  ) {
    return json(
      {
        error: {
          code: "BOOKING_CONFLICT",
          message: "That time slot is already booked.",
          requestId,
        },
      },
      409,
      requestId,
    );
  }
  logger.error("Unhandled API error", {
    requestId,
    error: message,
    stack: error instanceof Error ? error.stack : undefined,
  });
  const internal = errors.internal();
  return json(
    { error: { code: internal.code, message: internal.message, requestId } },
    500,
    requestId,
  );
}

function checkOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const cfg = getConfig();
  const allowed = new Set<string>([cfg.APP_ORIGIN, new URL(request.url).origin]);
  if (!allowed.has(origin)) throw errors.forbidden("Request origin is not allowed.");
}

export async function readUserFromRequest(): Promise<SessionUser | null> {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}

export function withApi(
  options: { public?: boolean; roles?: Role[]; action?: string },
  handler: (ctx: ApiContext) => Promise<Response> | Response,
): (
  request: Request,
  context?: { params?: Promise<Record<string, string>> },
) => Promise<Response> {
  return async (request, context) => {
    const requestId = request.headers.get("x-request-id") || randomUUID();
    let user: SessionUser | null = null;
    try {
      checkOrigin(request);
      const params = context?.params ? await context.params : {};
      user = await readUserFromRequest();
      if (!options.public) {
        if (!user) throw errors.unauthenticated();
        if (options.roles && !options.roles.includes(user.role)) {
          writeAudit({
            institutionId: user.institutionId,
            actorId: user.id,
            action: `${options.action ?? new URL(request.url).pathname}.denied`,
            entityType: "route",
            entityId: null,
            outcome: "DENIED",
            metadata: { code: "FORBIDDEN", method: request.method },
            requestId,
          });
          throw errors.forbidden();
        }
      }
      const response = await handler({
        request,
        requestId,
        user: user as SessionUser,
        params,
      });
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      if (
        user &&
        isAppError(error) &&
        (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
      ) {
        writeAudit({
          institutionId: user.institutionId,
          actorId: user.id,
          action: `${options.action ?? new URL(request.url).pathname}.denied`,
          entityType: "route",
          entityId: null,
          outcome: "DENIED",
          metadata: { code: error.code, method: request.method },
          requestId,
        });
      }
      return errorResponse(error, requestId);
    }
  };
}

export function withPublicApi(
  handler: (ctx: PublicApiContext) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return withApi({ public: true }, async (ctx) => handler(ctx));
}

export async function parseJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("VALIDATION_FAILED", "Request body must be valid JSON.", 422);
  }
}
