import { json, parseJson, withApi } from "@/lib/api";
import { incidentCreateSchema, parseSchema } from "@/lib/schemas";
import { rateLimit } from "@/server/rate-limit";
import { errors } from "@/lib/errors";
import { createIncidentForUser, incidentListForUser } from "@/server/services/incidents";
import type { IncidentSeverity, IncidentStatus } from "@/domain/types";

export const GET = withApi({}, async ({ user, request }) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as IncidentStatus | null;
  const severity = url.searchParams.get("severity") as IncidentSeverity | null;
  return json({
    incidents: incidentListForUser(user, {
      status: status ?? undefined,
      severity: severity ?? undefined,
    }),
  });
});

export const POST = withApi(
  { action: "incident.create" },
  async ({ user, request, requestId }) => {
    if (!rateLimit(`incident:create:${user.id}`, 10, 60 * 60_000))
      throw errors.rateLimited();
    const input = parseSchema(incidentCreateSchema, await parseJson(request));
    const incident = createIncidentForUser(user, input, requestId);
    return json({ incident }, 201);
  },
);
