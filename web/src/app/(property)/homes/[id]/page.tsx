import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { findHome } from "@/modules/property/lib/homes";
import { BuildingPage, UnitPage } from "@/modules/property/components/home-detail";
import { fullAddress, money, psf } from "@/modules/property/lib/format";
import "@/modules/rentals/market/market.css";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [{ id }, s] = await Promise.all([params, getSetup()]);
  const f = s.property ? await findHome(s.property, id).catch(() => null) : null;
  if (!f) return { title: "Home not found" };
  const t = f.unit && f.home.kind === "building" ? `${f.unit.title}, ${f.home.title}` : f.home.title;
  const img = (f.unit?.images || f.home.images)[0];
  return {
    title: t,
    description: f.unit ? `${f.unit.segment === "commercial" ? psf(f.unit.ratePsf) : `${money(f.unit.rent)}/mo`} · ${fullAddress(f.unit.address)}` : `${f.home.type} at ${fullAddress(f.home.address)}`,
    openGraph: img ? { images: [img] } : undefined,
  };
}

/** /homes/[id] — a building (its availability grid), or one home: an apartment or room
 *  in a building, or a whole house. */
export default async function HomePage({ params }: { params: Params }) {
  const [{ id }, setup, session] = await Promise.all([params, getSetup(), getSession()]);
  const cfg = setup.property!;
  const [found, mapsKey] = await Promise.all([findHome(cfg, id).catch(() => null), getMapsKey().catch(() => null)]);
  if (!found) notFound();
  const { home, unit } = found;
  return (
    <>
      <SiteHeader />
      <main>
        {unit
          ? <UnitPage cfg={cfg} home={home} unit={unit} mapsKey={mapsKey} signedIn={session.signedIn} />
          : <BuildingPage cfg={cfg} home={home} mapsKey={mapsKey} />}
      </main>
      <SiteFooter />
    </>
  );
}
