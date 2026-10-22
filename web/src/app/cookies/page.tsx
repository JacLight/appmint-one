import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { GenericPage } from "@/components/site/generic-page";
import { cookiesPage } from "@/components/site/generic-pages";
import { StowboCookies } from "@/modules/rentals/legal/cookies";

export async function generateMetadata(): Promise<Metadata> {
  const setup = await getSetup();
  const page = cookiesPage(setup);
  return { title: page.title, description: page.description };
}

/** Stowbo's own page for the Stowbo setup; the short templated page for everyone else. */
export default async function Page() {
  const setup = await getSetup();
  if (setup.legal.variant === "stowbo") return <StowboCookies />;
  return <GenericPage page={cookiesPage(setup)} />;
}
