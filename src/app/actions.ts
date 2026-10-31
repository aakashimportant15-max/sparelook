"use server";

import { redirect } from "next/navigation";
import { signOutCurrentSession } from "@/server/session";

export async function signOutAction(): Promise<void> {
  await signOutCurrentSession();
  redirect("/sign-in?signedOut=1");
}
