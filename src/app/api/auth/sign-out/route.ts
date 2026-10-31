import { json, withApi } from "@/lib/api";
import { signOutCurrentSession } from "@/server/session";

export const POST = withApi({ public: true, action: "auth.sign_out" }, async () => {
  await signOutCurrentSession();
  return json({ ok: true });
});
