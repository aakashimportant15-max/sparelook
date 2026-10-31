import { json, parseJson, withApi } from "@/lib/api";
import { overrideSchema, parseSchema } from "@/lib/schemas";
import { approveBooking } from "@/server/services/bookings";

export const POST = withApi(
  { roles: ["OWNER", "ADMIN"], action: "booking.approve" },
  async ({ user, request, requestId, params }) => {
    const input = parseSchema(overrideSchema, await parseJson(request));
    return json(approveBooking(user, params.id, input.overrideReason, requestId));
  },
);
