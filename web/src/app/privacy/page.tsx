import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { GenericPage } from "@/components/site/generic-page";
import { privacyPage } from "@/components/site/generic-pages";
import { StowboPrivacy } from "@/modules/rentals/legal/privacy";

export async function generateMetadata(): Promise<Metadata> {
  const setup = await getSetup();
  const page = privacyPage(setup);
  return { title: page.title, description: page.description };
}

/** Stowbo's own page for the Stowbo setup; the short templated page for everyone else. */
export default async function Page() {
  const setup = await getSetup();
  if (setup.legal.variant === "stowbo") return <StowboPrivacy />;
  return <GenericPage page={privacyPage(setup)} />;
}
