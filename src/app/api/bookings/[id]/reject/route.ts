import { json, parseJson, withApi } from "@/lib/api";
import { parseSchema, reasonSchema } from "@/lib/schemas";
import { rejectBooking } from "@/server/services/bookings";

export const POST = withApi(
  { roles: ["OWNER", "ADMIN"], action: "booking.reject" },
  async ({ user, request, requestId, params }) => {
    const input = parseSchema(reasonSchema, await parseJson(request));
    return json({ booking: rejectBooking(user, params.id, input.reason, requestId) });
  },
);
