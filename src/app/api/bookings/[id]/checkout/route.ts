import { json, parseJson, withApi } from "@/lib/api";
import { conditionSchema, parseSchema } from "@/lib/schemas";
import { checkoutBooking } from "@/server/services/bookings";

export const POST = withApi(
  { roles: ["OWNER", "ADMIN"], action: "booking.checkout" },
  async ({ user, request, requestId, params }) => {
    const input = parseSchema(conditionSchema, await parseJson(request));
    return json({ booking: checkoutBooking(user, params.id, input, requestId) });
  },
);
