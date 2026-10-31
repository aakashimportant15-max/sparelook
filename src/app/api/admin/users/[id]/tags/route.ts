import { json, parseJson, withApi } from "@/lib/api";
import { errors } from "@/lib/errors";
import { parseSchema, tagsSchema } from "@/lib/schemas";
import { writeAudit } from "@/server/audit";
import { getUserSummary, setUserTags } from "@/server/repos/users";

export const PATCH = withApi(
  { roles: ["ADMIN"], action: "admin.user.tags" },
  async ({ user, request, requestId, params }) => {
    const target = getUserSummary(user.institutionId, params.id);
    if (!target) throw errors.notFound("We could not find that member.");
    const input = parseSchema(tagsSchema, await parseJson(request));
    setUserTags(user.institutionId, params.id, input.groups, input.trainings);
    writeAudit({
      institutionId: user.institutionId,
      actorId: user.id,
      action: "user.tags_changed",
      entityType: "user",
      entityId: params.id,
      metadata: { groups: input.groups.length, trainings: input.trainings.length },
      requestId,
    });
    return json({ user: getUserSummary(user.institutionId, params.id) });
  },
);
