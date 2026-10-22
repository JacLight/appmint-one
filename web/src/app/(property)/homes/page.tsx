import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSetup } from "@/lib/setup";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { portfolio, search } from "@/modules/property/lib/homes";
import { Browse } from "@/modules/property/components/browse";
import "@/modules/rentals/market/market.css";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetup();
  return { title: s.property?.copy.browseTitle || "Homes", description: s.property?.copy.browseLead };
}

type SP = Promise<Record<string, string | undefined>>;
const n = (v?: string) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** /homes — every available home, narrowed by the filters in the URL. */
export default async function HomesPage({ searchParams }: { searchParams: SP }) {
  const [setup, sp] = await Promise.all([getSetup(), searchParams]);
  const cfg = setup.property!;
  if (!cfg.segments.includes("residential")) redirect("/commercial");
  const [all, mapsKey] = await Promise.all([portfolio(cfg).catch(() => []), getMapsKey().catch(() => null)]);
  const homes = search(all, {
    segment: "residential", q: sp.q, types: (sp.type || "").split(",").filter(Boolean), beds: n(sp.beds), maxRent: n(sp.max),
    pets: !!sp.pets, furnished: !!sp.furnished, moveIn: sp.moveIn, sort: sp.sort,
  });
  const type = cfg.types.find((t) => t.id === sp.type);
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense>
          <Browse cfg={cfg} homes={homes} mapsKey={mapsKey} title={type ? `${type.plural} available now` : cfg.copy.browseTitle} lead={cfg.copy.browseLead} segment="residential" />
        </Suspense>
      </main>
    </>
  );
}
