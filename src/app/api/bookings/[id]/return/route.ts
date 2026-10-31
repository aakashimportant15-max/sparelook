import { json, parseJson, withApi } from "@/lib/api";
import { conditionSchema, parseSchema } from "@/lib/schemas";
import { returnBooking } from "@/server/services/bookings";

export const POST = withApi(
  { roles: ["OWNER", "ADMIN"], action: "booking.return" },
  async ({ user, request, requestId, params }) => {
    const input = parseSchema(conditionSchema, await parseJson(request));
    return json(returnBooking(user, params.id, input, requestId));
  },
);
