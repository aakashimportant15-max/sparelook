import { cookies } from "next/headers";
import { errors } from "../lib/errors";
import { SESSION_COOKIE, getSessionUser, revokeSession } from "./auth";
import type { Role, SessionUser } from "../domain/types";

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
}

export async function requireCurrentUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw errors.unauthenticated();
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireCurrentUser();
  if (!roles.includes(user.role)) throw errors.forbidden();
  return user;
}

export async function signOutCurrentSession(): Promise<void> {
  const store = await cookies();
  revokeSession(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}
