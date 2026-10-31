import { createBooking } from "../../src/server/services/bookings";
import { getUserById } from "../../src/server/auth";
import { isAppError } from "../../src/lib/errors";

type Result = { ok: boolean; code?: string; bookingId?: string; message?: string };

function emit(result: Result): void {
  process.stdout.write(`RESULT:${JSON.stringify(result)}\n`);
}

const userId = process.env.CONC_USER_ID ?? "";
const startAt = process.env.CONC_START_AT ?? "";
const endAt = process.env.CONC_END_AT ?? "";
const key = process.env.CONC_KEY ?? "";

const user = getUserById(userId);
if (!user) {
  emit({ ok: false, code: "NO_USER", message: userId });
  process.exit(0);
}

try {
  const result = createBooking(
    user,
    {
      resourceId: "r05",
      startAt,
      endAt,
      purpose: "Concurrency harness booking",
    },
    key,
    `conc-${process.pid}`,
  );
  emit({ ok: true, bookingId: result.booking.id });
} catch (error) {
  if (isAppError(error)) {
    emit({ ok: false, code: error.code, message: error.message });
  } else {
    emit({
      ok: false,
      code: "UNEXPECTED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
