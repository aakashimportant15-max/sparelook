import { json, parseJson, withApi } from "@/lib/api";
import { errors } from "@/lib/errors";
import { bookingCreateSchema, parseSchema } from "@/lib/schemas";
import { rateLimit } from "@/server/rate-limit";
import { createBooking, myBookings } from "@/server/services/bookings";

export const GET = withApi({}, async ({ user }) => {
  return json(myBookings(user));
});

export const POST = withApi(
  { action: "booking.create" },
  async ({ user, request, requestId }) => {
    if (!rateLimit(`booking:create:${user.id}`, 20, 60 * 60_000))
      throw errors.rateLimited();
    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw errors.validation([
        {
          field: "Idempotency-Key",
          code: "REQUIRED",
          message: "A valid Idempotency-Key header is required.",
        },
      ]);
    }
    const input = parseSchema(bookingCreateSchema, await parseJson(request));
    const result = createBooking(user, input, idempotencyKey, requestId);
    return json(
      { booking: result.booking, replay: result.replay },
      result.replay ? 200 : 201,
    );
  },
);
