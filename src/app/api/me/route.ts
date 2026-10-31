import { json, withApi } from "@/lib/api";

export const GET = withApi({}, async ({ user }) =>
  json({
    user: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: user.status,
      institutionId: user.institutionId,
      timezone: user.timezone,
      groups: user.groups,
      trainings: user.trainings,
    },
  }),
);
