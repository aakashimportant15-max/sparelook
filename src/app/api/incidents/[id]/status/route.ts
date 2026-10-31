import { json, parseJson, withApi } from "@/lib/api";
import { incidentUpdateSchema, parseSchema } from "@/lib/schemas";
import { updateIncidentForUser } from "@/server/services/incidents";

export const PATCH = withApi(
  { roles: ["OWNER", "ADMIN"], action: "incident.update" },
  async ({ user, request, requestId, params }) => {
    const input = parseSchema(incidentUpdateSchema, await parseJson(request));
    const incident = updateIncidentForUser(
      user,
      params.id,
      input.status,
      input.resolutionNote,
      requestId,
    );
    return json({ incident });
  },
);
