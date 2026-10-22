import type { Metadata } from "next";
import { ProviderComingSoon, providerComingSoonMetadata } from "@/components/provider-coming-soon";

/** /provider/* links of a provider area that isn't built yet. A built provider area
 *  (Logistics: /provider/jobs, /provider/earnings …) owns static routes, which win. */
export async function generateMetadata(): Promise<Metadata> {
  return providerComingSoonMetadata();
}

export default async function ProviderSubPage() {
  return <ProviderComingSoon />;
}
