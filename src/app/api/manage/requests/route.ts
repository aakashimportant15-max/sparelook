import { json, withApi } from "@/lib/api";
import { requestQueue } from "@/server/services/bookings";

export const GET = withApi(
  { roles: ["OWNER", "ADMIN"], action: "booking.queue" },
  async ({ user }) => json(requestQueue(user)),
);
