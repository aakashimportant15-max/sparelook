import { redirect } from "next/navigation";
import type { Role, SessionUser } from "@/domain/types";
import { getCurrentUser } from "./session";

export async function requirePageUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user)
    redirect(nextPath ? `/sign-in?next=${encodeURIComponent(nextPath)}` : "/sign-in");
  return user;
}

export async function requirePageRole(
  roles: Role[],
  nextPath?: string,
): Promise<SessionUser> {
  const user = await requirePageUser(nextPath);
  if (!roles.includes(user.role)) redirect("/forbidden");
  return user;
}
