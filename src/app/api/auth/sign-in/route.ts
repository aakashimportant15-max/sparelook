import { cookies } from "next/headers";
import { json, parseJson, withApi } from "@/lib/api";
import { getConfig } from "@/lib/config";
import { AppError, errors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parseSchema, signInSchema } from "@/lib/schemas";
import { SESSION_COOKIE, findUserRowByEmail, signIn } from "@/server/auth";
import { writeAudit } from "@/server/audit";
import { rateLimit } from "@/server/rate-limit";

export const POST = withApi(
  { public: true, action: "auth.sign_in" },
  async ({ request, requestId }) => {
    const body = parseSchema(signInSchema, await parseJson(request));
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "local";
    const key = `signin:${body.email.toLowerCase()}:${ip}`;
    if (!rateLimit(key, 10, 15 * 60_000)) throw errors.rateLimited();

    const result = signIn(body.email, body.password);
    const knownUser = findUserRowByEmail(body.email);
    if (!result.ok) {
      if (knownUser) {
        writeAudit({
          institutionId: knownUser.institutionId,
          actorId: knownUser.id,
          action: "auth.sign_in",
          entityType: "session",
          entityId: null,
          outcome: "FAILED",
          metadata: { reason: result.reason },
          requestId,
        });
      }
      logger.warn("Sign-in failed", { requestId, reason: result.reason });
      if (result.reason === "SUSPENDED") {
        throw new AppError(
          "UNAUTHENTICATED",
          "This account is not available. Contact an institution administrator.",
          401,
        );
      }
      throw new AppError("UNAUTHENTICATED", "Email or password is incorrect.", 401);
    }

    const cfg = getConfig();
    const store = await cookies();
    store.set(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: cfg.APP_ORIGIN.startsWith("https"),
      path: "/",
      expires: new Date(result.expiresAt),
    });

    writeAudit({
      institutionId: result.user.institutionId,
      actorId: result.user.id,
      action: "auth.sign_in",
      entityType: "session",
      entityId: result.user.id,
      metadata: { role: result.user.role },
      requestId,
    });

    return json({
      user: {
        id: result.user.id,
        displayName: result.user.displayName,
        email: result.user.email,
        role: result.user.role,
        institutionId: result.user.institutionId,
        timezone: result.user.timezone,
      },
    });
  },
);
