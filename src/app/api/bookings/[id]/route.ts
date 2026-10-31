import { json, withApi } from "@/lib/api";
import { bookingDetail } from "@/server/services/bookings";

export const GET = withApi({ action: "booking.read" }, async ({ user, params }) => {
  return json(bookingDetail(user, params.id));
});
