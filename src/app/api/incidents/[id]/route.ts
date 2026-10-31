import { json, withApi } from "@/lib/api";
import { incidentDetail } from "@/server/services/incidents";

export const GET = withApi({ action: "incident.read" }, async ({ user, params }) =>
  json(incidentDetail(user, params.id)),
);
