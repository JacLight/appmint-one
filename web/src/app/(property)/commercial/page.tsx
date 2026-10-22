import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSetup } from "@/lib/setup";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { portfolio, search } from "@/modules/property/lib/homes";
import { Browse } from "@/modules/property/components/browse";
import "@/modules/rentals/market/market.css";

export async function generateMetadata(): Promise<Metadata> {
  const c = (await getSetup()).property?.commercial;
  return { title: c?.copy.browseTitle || "Commercial space", description: c?.copy.browseLead };
}

type SP = Promise<Record<string, string | undefined>>;
const n = (v?: string) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** /commercial — offices, storefronts and warehouse space, narrowed by the filters in the URL. */
export default async function CommercialPage({ searchParams }: { searchParams: SP }) {
  const [setup, sp] = await Promise.all([getSetup(), searchParams]);
  const cfg = setup.property!;
  if (!cfg.segments.includes("commercial") || !cfg.commercial) notFound();
  const [all, mapsKey] = await Promise.all([portfolio(cfg).catch(() => []), getMapsKey().catch(() => null)]);
  const homes = search(all, {
    segment: "commercial", q: sp.q, types: (sp.type || "").split(",").filter(Boolean),
    minSqft: n(sp.minSf), maxPsf: n(sp.maxPsf), leaseType: sp.lease, sort: sp.sort,
  });
  const type = cfg.types.find((t) => t.id === sp.type);
  return (
    <>
      <SiteHeader />
      <main>
        <Suspense>
          <Browse cfg={cfg} homes={homes} mapsKey={mapsKey} segment="commercial"
            title={type ? `${type.plural} space available` : cfg.commercial.copy.browseTitle} lead={cfg.commercial.copy.browseLead} />
        </Suspense>
      </main>
    </>
  );
}
