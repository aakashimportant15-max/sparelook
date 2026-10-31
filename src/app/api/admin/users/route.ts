import { json, withApi } from "@/lib/api";
import { listUsers } from "@/server/repos/users";

export const GET = withApi(
  { roles: ["ADMIN"], action: "admin.users" },
  async ({ user }) => json({ users: listUsers(user.institutionId) }),
);
