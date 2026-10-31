import { json, withApi } from "@/lib/api";
import { countAuditEvents, listAuditEvents } from "@/server/audit";

export const GET = withApi(
  { roles: ["ADMIN"], action: "admin.audit" },
  async ({ user, request }) => {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? undefined;
    const outcome = url.searchParams.get("outcome") ?? undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const limit = 50;
    const events = listAuditEvents({
      institutionId: user.institutionId,
      action,
      outcome,
      limit,
      offset: (page - 1) * limit,
    });
    return json({ events, total: countAuditEvents(user.institutionId), page, limit });
  },
);
