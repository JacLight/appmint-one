import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { isOn } from "@/setups/modules";
import { ProviderComingSoon, providerComingSoonMetadata } from "@/components/provider-coming-soon";
import { redirect } from "next/navigation";
import { ProviderToday } from "@/modules/scheduling/components/provider/provider-today";

/** The provider home. Driving is app-only, so logistics setups send drivers to the
 *  Drive page; setups whose provider side isn't built yet get the coming-soon page. */
async function isDriverArea() {
  const setup = await getSetup();
  return isOn(setup, "logistics") && !setup.provider;
}

/** Scheduling setups (studio, medical, law-firm): the team member's day. */
async function isSchedulingArea() {
  const setup = await getSetup();
  return isOn(setup, "scheduling") && setup.provider?.module === "scheduling" && !!setup.scheduling;
}

export async function generateMetadata(): Promise<Metadata> {
  if (await isSchedulingArea()) return { title: "Today" };
  return providerComingSoonMetadata();
}

export default async function ProviderHome() {
  if (await isSchedulingArea()) return <ProviderToday />;
  if (await isDriverArea()) redirect("/drive");
  return <ProviderComingSoon />;
}
