import { json, parseJson, withApi } from "@/lib/api";
import { parseSchema, resourceStatusSchema } from "@/lib/schemas";
import { changeResourceStatus } from "@/server/services/resources";

export const POST = withApi(
  { roles: ["ADMIN", "OWNER"], action: "resource.status" },
  async ({ user, params, request, requestId }) => {
    const input = parseSchema(resourceStatusSchema, await parseJson(request));
    const result = changeResourceStatus(user, params.id, input.status, requestId);
    return json(result);
  },
);
