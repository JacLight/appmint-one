import { notFound, redirect } from "next/navigation";
import { getSession, type Session } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { isOn } from "@/setups/modules";
import type { ModuleId } from "@/setups/types";

/** Require a signed-in customer; otherwise send to /login. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s.signedIn) redirect("/login");
  return s;
}

/** Require an APPROVED provider (Rentals: host); otherwise send to the provider home. */
export async function requireHost(): Promise<Session> {
  const s = await requireSession();
  if (!s.host) redirect((await getSetup()).provider?.home || "/host");
  return s;
}

/** 404 unless the active setup has this module on — a module's routes do not exist
 *  for setups that don't use it. */
export async function requireModule(id: ModuleId): Promise<void> {
  if (!isOn(await getSetup(), id)) notFound();
}
