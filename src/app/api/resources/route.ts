import { json, parseJson, withApi } from "@/lib/api";
import { parseSchema, resourceSchema } from "@/lib/schemas";
import { createResourceForAdmin, listCatalogue } from "@/server/services/resources";

export const GET = withApi({}, async ({ user, request }) => {
  const url = new URL(request.url);
  const result = listCatalogue(user, {
    q: url.searchParams.get("q") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    eligibleOnly: url.searchParams.get("eligibleForMe") === "true",
    page: Number(url.searchParams.get("page") ?? "1") || 1,
  });
  return json(result);
});

export const POST = withApi(
  { roles: ["ADMIN"], action: "resource.create" },
  async ({ user, request, requestId }) => {
    const input = parseSchema(resourceSchema, await parseJson(request));
    const resource = createResourceForAdmin(user, input, requestId);
    return json({ resource }, 201);
  },
);
