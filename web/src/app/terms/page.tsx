import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { GenericPage } from "@/components/site/generic-page";
import { termsPage } from "@/components/site/generic-pages";
import { StowboTerms } from "@/modules/rentals/legal/terms";

export async function generateMetadata(): Promise<Metadata> {
  const setup = await getSetup();
  const page = termsPage(setup);
  return { title: page.title, description: page.description };
}

/** Stowbo's own page for the Stowbo setup; the short templated page for everyone else. */
export default async function Page() {
  const setup = await getSetup();
  if (setup.legal.variant === "stowbo") return <StowboTerms />;
  return <GenericPage page={termsPage(setup)} />;
}
