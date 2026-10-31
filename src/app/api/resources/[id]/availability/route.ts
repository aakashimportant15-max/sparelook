import { addDays } from "@/lib/time";
import { json, withApi } from "@/lib/api";
import { visibleResource } from "@/server/services/resources";
import { busyBlocks } from "@/server/repos/resources";

export const GET = withApi({}, async ({ user, params, request }) => {
  const resource = visibleResource(user, params.id);
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const now = new Date();
  const fromDate = from ? new Date(from) : now;
  const toDate = to ? new Date(to) : addDays(now, 30);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid date range." } },
      422,
    );
  }
  const blocks = busyBlocks(resource.id, fromDate.toISOString(), toDate.toISOString());
  return json({ resourceId: resource.id, busyBlocks: blocks });
});
