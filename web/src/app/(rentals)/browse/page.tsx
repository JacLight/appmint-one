import { SiteHeader } from "@/components/site-header";
import { BrowseResults, type BrowseItem } from "@/modules/rentals/components/browse/browse-results";
import { BrowseFilters } from "@/modules/rentals/components/browse/browse-filters";
import { stowbo } from "@/api/rentals";
import { listingCoords } from "@/modules/rentals/lib/geo";
import { getMapsKey } from "@/modules/rentals/lib/maps";
import { geocodeAddress, addressString } from "@/modules/rentals/lib/geocode";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketBrowse, type MarketBrowseSP } from "@/modules/rentals/market/market-browse";

export const metadata = { title: "Browse spaces" };

type BrowseSP = {
  c?: string; q?: string; from?: string; to?: string;
  pmin?: string; pmax?: string; smin?: string; smax?: string; dist?: string;
  staffing?: string; amenities?: string; sort?: string;
};

const csv = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** First image URL from a listing's `images` (handles both string[] and FileInfo[]). */
function firstImageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images) || images.length === 0) return undefined;
  const first = images[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object" && "url" in first) return (first as { url?: string }).url;
  return undefined;
}

/** Staffing bucket match — data uses assorted words; group into staffed / self-serve. */
function staffingMatches(want: string, val?: string): boolean {
  const v = (val ?? "").toLowerCase();
  if (want === "staffed") return /staff|mann(?!.*un)|attended|concierge/.test(v) && !/self|un-?mann/.test(v);
  if (want === "self-serve") return /self|un-?mann|unattended/.test(v) || v === "";
  return false;
}

/** Best-effort numeric size (sq ft) from the listing's size field. "5×5 ft" → 25, "200" → 200. */
function parseSize(size: unknown): number | null {
  if (typeof size === "number") return size;
  if (typeof size !== "string") return null;
  const nums = (size.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  if (nums.length >= 2) return nums[0] * nums[1];
  if (nums.length === 1) return nums[0];
  return null;
}

/** Great-circle distance in miles. */
function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<BrowseSP> }) {
  const sp = await searchParams;
  // Stays / gear setups have their own search; Stowbo continues below, unchanged.
  const market = await getMarket();
  if (market) return <MarketBrowse m={market} sp={sp as MarketBrowseSP} />;
  const classSel = csv(sp.c);
  const staffSel = csv(sp.staffing);
  const amenSel = csv(sp.amenities);
  const pmin = sp.pmin ? Number(sp.pmin) : null;
  const pmax = sp.pmax ? Number(sp.pmax) : null;
  const smin = sp.smin ? Number(sp.smin) : null;
  const smax = sp.smax ? Number(sp.smax) : null;
  const datesSet = !!(sp.from || sp.to);

  const [res, mapsKey] = await Promise.all([
    // one class ⇒ let the backend narrow it; multi-class ⇒ fetch broad, filter below
    stowbo.listings({ keyword: sp.q, spaceType: classSel.length === 1 ? classSel[0] : undefined, pageSize: 200 }).catch(() => null),
    getMapsKey(),
  ]);
  const listings = res?.data ?? [];

  // A typed "Where to" is the explicit center point → geocode it. "My location"
  // (the visitor's own coords) is handled CLIENT-SIDE in BrowseResults so the
  // precise coordinates never touch the URL. A searched place always wins.
  const origin = sp.q && mapsKey ? await geocodeAddress(sp.q, mapsKey) : null;
  // 20-mile radius by default once there's a searched center; an explicit dist overrides.
  const maxDist = sp.dist ? Number(sp.dist) : (origin ? 20 : null);

  // Filter on the RAW listing data first (cheap) — the backend browse only does
  // city/spaceType/keyword, so class(multi)/price/staffing/amenities/availability run here.
  const filtered = listings.filter((l) => {
    const d = l.data ?? {};
    if (classSel.length && !classSel.includes(d.spaceType ?? "")) return false;
    if (pmin != null && !(typeof d.price === "number" && d.price >= pmin)) return false;
    if (pmax != null && !(typeof d.price === "number" && d.price <= pmax)) return false;
    if (staffSel.length && !staffSel.some((w) => staffingMatches(w, d.staffing))) return false;
    if (amenSel.length) {
      const feats = (d.features ?? []).map((f: string) => f.toLowerCase());
      if (!amenSel.every((a) => feats.includes(a.toLowerCase()))) return false;
    }
    if (smin != null || smax != null) {
      const sz = parseSize(d.size);
      if (sz == null) return false;                 // size filter set but this listing has no parseable size
      if (smin != null && sz < smin) return false;
      if (smax != null && sz > smax) return false;
    }
    if (datesSet && !((d.capacity ?? 0) > 0)) return false; // has space free for the requested dates
    return true;
  });

  let items: BrowseItem[] = await Promise.all(
    filtered.map(async (l): Promise<BrowseItem> => {
      const d = l.data;
      const base = {
        sk: l.sk,
        title: d?.title ?? "Untitled space",
        spaceType: d?.spaceType ?? "space",
        city: d?.address?.city ?? "",
        staffing: d?.staffing ?? "self-serve",
        capacity: d?.capacity ?? 1,
        size: d?.size,
        price: d?.price,
        priceUnit: d?.priceUnit,
        features: (d?.features ?? []).slice(0, 3),
        image: firstImageUrl(d?.images),
      };
      let lat = d?.location?.lat;
      let lng = d?.location?.lng;
      if ((lat == null || lng == null) && mapsKey) {
        const g = await geocodeAddress(addressString(d?.address), mapsKey);
        if (g) { lat = g.lat; lng = g.lng; }
      }
      if (lat == null || lng == null) {
        const c = listingCoords(l.sk, d?.address?.city);
        lat = c.lat; lng = c.lng;
      }
      return { ...base, lat, lng };
    }),
  );

  // Distance filter — needs resolved coords + a geocoded search origin.
  if (maxDist != null && origin) {
    items = items.filter((it) => milesBetween(origin, { lat: it.lat, lng: it.lng }) <= maxDist);
    items = [...items].sort((a, b) => milesBetween(origin, a) - milesBetween(origin, b)); // nearest first
  }

  if (sp.sort === "price-asc") items = [...items].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  else if (sp.sort === "price-desc") items = [...items].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
  else if (sp.sort === "space") items = [...items].sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));

  return (
    <>
      <SiteHeader />

      <BrowseFilters sp={sp} resultCount={items.length} />

      {/* Always render the results shell so the map is present even with 0 listings. */}
      <BrowseResults items={items} apiKey={mapsKey} origin={origin} dateQuery={(() => { const p = new URLSearchParams(); if (sp.from) p.set("from", sp.from); if (sp.to) p.set("to", sp.to); const q = p.toString(); return q ? `?${q}` : ""; })()} />
    </>
  );
}
