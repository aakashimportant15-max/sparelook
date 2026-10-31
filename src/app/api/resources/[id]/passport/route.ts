import { json, withApi } from "@/lib/api";
import { passportFor } from "@/server/services/passport";

export const GET = withApi({}, async ({ user, params }) => {
  const passport = passportFor(user, params.id);
  return json(passport);
});
