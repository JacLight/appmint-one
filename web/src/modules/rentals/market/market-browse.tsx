import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { clientCfg, type getMarket } from "./config";
import { searchMarket, toCard, type MarketEnvelope } from "./api";
import { SearchBar } from "./search-bar";
import { BrowseSplit, FilterChips } from "./browse-client";
import { hourWindow, stayWindow, nightsBetween } from "./shared";
import "./market.css";

export type MarketBrowseSP = Record<string, string | undefined>;
const csv = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const num = (s?: string) => (s && !Number.isNaN(Number(s)) ? Number(s) : undefined);

/** Search results: chip filters, a card grid and a map with price pills. */
export async function MarketBrowse({ m, sp }: { m: NonNullable<Awaited<ReturnType<typeof getMarket>>>; sp: MarketBrowseSP }) {
  const { cfg } = m;
  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : undefined;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) && from && sp.to > from ? sp.to : undefined;
  const guests = { adults: num(sp.adults) || 0, children: num(sp.children) || 0, infants: num(sp.infants) || 0, pets: num(sp.pets) || 0 };
  const win = from && to ? (cfg.unit === "night" ? stayWindow(from, to) : hourWindow(from, 10 * 60, nightsBetween(from, to) * 24)) : null;
  const bounds = sp.swLat && sp.neLat && sp.swLng && sp.neLng ? { swLat: Number(sp.swLat), swLng: Number(sp.swLng), neLat: Number(sp.neLat), neLng: Number(sp.neLng) } : undefined;

  const [res, mapsKey] = await Promise.all([
    searchMarket(cfg, {
      q: sp.q, startDate: win?.startDate, endDate: win?.endDate,
      guests: guests.adults + guests.children || undefined, bedrooms: num(sp.bedrooms),
      types: csv(sp.types), amenities: csv(sp.amenities), minPrice: num(sp.minPrice), maxPrice: num(sp.maxPrice),
      sort: sp.sort, bounds,
    }).catch(() => ({ rows: [] as MarketEnvelope[], total: 0 })),
    getMapsKey().catch(() => null),
  ]);
  const cards = res.rows.map((r) => {
    const c = toCard(cfg, r);
    // An hourly space's total over whole days isn't the price anyone pays — show its rate only.
    if (c.unit === "hour" && cfg.unit !== "hour") { c.total = null; c.span = null; }
    return c;
  });

  const typeNames = csv(sp.types).map((t) => cfg.types.find((x) => x.id === t)?.plural).filter(Boolean) as string[];
  const noun = typeNames.length === 1 ? typeNames[0].toLowerCase() : cfg.unit === "night" ? "stays" : "rentals";
  const where = bounds ? "in this area" : sp.q ? `in ${sp.q.split(",")[0]}` : "";
  const count = cards.length;
  const dateQs = new URLSearchParams(Object.entries({ from, to, adults: sp.adults, children: sp.children, infants: sp.infants, pets: sp.pets }).filter(([, v]) => v) as [string, string][]).toString();
  const keep = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["swLat", "swLng", "neLat", "neLng"].includes(k)) as [string, string][]).toString();

  const title = count === 0 ? `No ${noun} ${where}`.trim() : `${count} ${count === 1 ? noun.replace(/s$/, "") : noun} ${where}`.trim();
  const note = win ? `${cfg.copy.priceNote} — totals shown are what you pay for your dates` : null;

  return (
    <>
      <SiteHeader />
      <main className="mk">
        <div className="mk-sbar">
          <div className="mk-wrap" style={{ maxWidth: "none" }}>
            <div className="mk-sbar-in">
              <SearchBar compact cfg={clientCfg(cfg)} keep={keep} initial={{ q: sp.q || "", from: from || null, to: to || null, guests }} />
              <Suspense><FilterChips cfg={clientCfg(cfg)} /></Suspense>
            </div>
          </div>
        </div>
        <Suspense>
          <BrowseSplit cards={cards} mapsKey={mapsKey} title={title} note={note} dateQs={dateQs} />
        </Suspense>
      </main>
    </>
  );
}
