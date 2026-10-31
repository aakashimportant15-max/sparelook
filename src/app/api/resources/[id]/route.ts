import { json, parseJson, withApi } from "@/lib/api";
import { parseSchema, resourcePatchSchema } from "@/lib/schemas";
import { resourceDetail, updateResourceForUser } from "@/server/services/resources";

export const GET = withApi({}, async ({ user, params }) =>
  json(resourceDetail(user, params.id)),
);

export const PATCH = withApi(
  { roles: ["ADMIN", "OWNER"], action: "resource.update" },
  async ({ user, params, request, requestId }) => {
    const input = parseSchema(resourcePatchSchema, await parseJson(request));
    const resource = updateResourceForUser(user, params.id, input, requestId);
    return json({ resource });
  },
);
