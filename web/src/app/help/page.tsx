import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { GenericPage } from "@/components/site/generic-page";
import { helpPage } from "@/components/site/generic-pages";
import { StowboHelp } from "@/modules/rentals/stowbo-help";

export async function generateMetadata(): Promise<Metadata> {
  const setup = await getSetup();
  const page = helpPage(setup);
  return { title: page.title, description: page.description };
}

/** Stowbo's own page for the Stowbo setup; the short templated page for everyone else. */
export default async function Page() {
  const setup = await getSetup();
  if (setup.home.variant === "stowbo") return <StowboHelp />;
  return <GenericPage page={helpPage(setup)} />;
}
