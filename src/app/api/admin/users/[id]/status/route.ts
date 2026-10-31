import { json, parseJson, withApi } from "@/lib/api";
import { errors } from "@/lib/errors";
import { parseSchema, userStatusSchema } from "@/lib/schemas";
import { revokeAllSessions } from "@/server/auth";
import { writeAudit } from "@/server/audit";
import { getUserSummary, setUserStatus } from "@/server/repos/users";

export const PATCH = withApi(
  { roles: ["ADMIN"], action: "admin.user.status" },
  async ({ user, request, requestId, params }) => {
    if (params.id === user.id) {
      throw errors.validation([
        {
          field: "status",
          code: "SELF",
          message: "You cannot change your own account status.",
        },
      ]);
    }
    const target = getUserSummary(user.institutionId, params.id);
    if (!target) throw errors.notFound("We could not find that member.");
    const input = parseSchema(userStatusSchema, await parseJson(request));
    setUserStatus(user.institutionId, params.id, input.status);
    if (input.status === "SUSPENDED") revokeAllSessions(params.id);
    writeAudit({
      institutionId: user.institutionId,
      actorId: user.id,
      action: input.status === "SUSPENDED" ? "user.suspended" : "user.reactivated",
      entityType: "user",
      entityId: params.id,
      metadata: {},
      requestId,
    });
    return json({ user: getUserSummary(user.institutionId, params.id) });
  },
);
