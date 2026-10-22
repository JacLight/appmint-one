import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { isOn } from "@/setups/modules";
import type { Session } from "@/lib/auth";

/** The provider area at /provider/* belongs to Scheduling only where the setup says so. */
export async function requireSchedulingArea(): Promise<void> {
  const setup = await getSetup();
  if (!isOn(setup, "scheduling") || setup.provider?.module !== "scheduling" || !setup.scheduling) notFound();
}

/** A team member (host of a booking type); anyone else goes to /provider. */
export async function requireTeamMember(): Promise<Session> {
  const s = await requireSession();
  if (!s.host) redirect((await getSetup()).provider?.home || "/provider");
  return s;
}
