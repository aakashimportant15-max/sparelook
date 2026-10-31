import { json, parseJson, withApi } from "@/lib/api";
import { parseSchema, reasonSchema } from "@/lib/schemas";
import { cancelBooking } from "@/server/services/bookings";

export const POST = withApi(
  { action: "booking.cancel" },
  async ({ user, request, requestId, params }) => {
    const input = parseSchema(reasonSchema, await parseJson(request));
    return json({ booking: cancelBooking(user, params.id, input.reason, requestId) });
  },
);
