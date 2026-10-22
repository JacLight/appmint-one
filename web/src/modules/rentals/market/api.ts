import "server-only";
import type { Envelope } from "@/lib/api";
import { stowbo, listingComments, addListingComment, hostListingFees, type StowboListing, type CheckoutQuote, type LineQuote } from "@/api/rentals";
import type { RentalsConfig } from "@/setups/rentals-config";
import { factsOf, spanLabel, unitFor, type MarketCard, type MarketQuote, type Rating } from "./shared";

/**
 * Stays and gear read and write through the EXISTING Stowbo client routes, all called
 * via src/api/rentals.ts (no route strings here). A setup's listings are the children of one
 * draft "market" listing (`cfg.market`), so they never appear in Stowbo's own
 * top-level browse, and the listing detail route returns them in one call:
 *
 *   GET  client/stowbo/listings/:market            → the vertical's listings (children)
 *   GET  client/stowbo/listings/:id/availability   → free for these dates? + the server's price
 *   GET  comments/stowbo_listing/:id               → reviews (generic comments, rating field)
 *   POST comments/stowbo_listing/:id               → leave a review
 */

export type MarketListing = StowboListing & {
  vertical?: string; marketRoot?: boolean; details?: Record<string, any>;
  quote?: LineQuote; available?: number;
};
export type MarketEnvelope = Envelope<MarketListing> & { rating?: Rating; owner?: any };

export function imageList(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.map((x: any) => (typeof x === "string" ? x : x?.url)).filter(Boolean);
}

export function toCard(cfg: RentalsConfig, row: MarketEnvelope): MarketCard {
  const d = row.data || ({} as MarketListing);
  const unit = unitFor(cfg, d.priceUnit);
  const type = cfg.types.find((t) => t.id === d.spaceType);
  const imgs = imageList(d.images);
  const q = d.quote as any;
  const minutes = q?.rateLines?.reduce?.((m: number, r: any) => m + Number(r.minutes || 0), 0);
  return {
    id: String(row.sk),
    title: d.title || "Untitled",
    type: d.spaceType || "",
    typeLabel: d.details?.propertyType || type?.label || "",
    city: d.address?.city || "",
    state: d.address?.state || "",
    image: imgs[0] || null,
    images: imgs.slice(0, 5),
    price: typeof d.price === "number" ? d.price : (d.rates?.bands?.[0]?.amount ?? null),
    unit,
    facts: factsOf(cfg, d.details),
    rating: row.rating || { average: null, count: 0 },
    lat: typeof d.location?.lat === "number" ? d.location.lat : null,
    lng: typeof d.location?.lng === "number" ? d.location.lng : null,
    total: q?.total ?? null,
    span: q ? spanLabel(minutes, unit) : null,
    badge: (row.rating?.average ?? 0) >= 4.85 && (row.rating?.count ?? 0) >= 3 ? "Guest favourite" : null,
  };
}

export interface SearchInput {
  q?: string; startDate?: string; endDate?: string;
  guests?: number; bedrooms?: number; types?: string[]; amenities?: string[];
  minPrice?: number; maxPrice?: number; sort?: string;
  bounds?: { swLat: number; swLng: number; neLat: number; neLng: number };
}

/** Average rating per listing from its reviews (comments with a rating). */
async function ratingsFor(ids: string[]): Promise<Record<string, Rating>> {
  const out: Record<string, Rating> = {};
  await Promise.all(ids.map(async (id) => {
    const r = await listingReviews(id);
    out[id] = { average: r.average, count: r.count };
  }));
  return out;
}

/** Every active listing in this setup's vertical: the children of its market listing. */
export async function verticalListings(cfg: RentalsConfig): Promise<MarketEnvelope[]> {
  if (!cfg.market) return [];
  const root: any = await stowbo.listing(cfg.market).catch(() => null);
  return ((root?.children as MarketEnvelope[]) || []).filter((r) => r.data?.status === "active" && !r.data?.marketRoot && (!cfg.vertical || r.data?.vertical === cfg.vertical));
}

/**
 * Search. The listing set is the vertical's; place, type, rooms, amenities and price
 * narrow it. With dates, each listing asks the engine's availability route, so only
 * what can really take the booking stays in, carrying the server's total for it.
 */
export async function searchMarket(cfg: RentalsConfig, s: SearchInput): Promise<{ rows: MarketEnvelope[]; total: number }> {
  let rows = await verticalListings(cfg);
  const text = String(s.q || "").split(",")[0].trim().toLowerCase();
  if (text && !s.bounds) {
    rows = rows.filter((r) => [r.data?.address?.city, r.data?.address?.state, r.data?.title, r.data?.description, r.data?.details?.propertyType]
      .some((v) => String(v || "").toLowerCase().includes(text)) || stateName(r.data?.address?.state).includes(text));
  }
  if (s.bounds) rows = rows.filter((r) => {
    const { lat, lng } = r.data?.location || ({} as any);
    return lat >= s.bounds!.swLat && lat <= s.bounds!.neLat && lng >= s.bounds!.swLng && lng <= s.bounds!.neLng;
  });
  if (s.types?.length) rows = rows.filter((r) => s.types!.includes(String(r.data?.spaceType)));
  if (s.guests) rows = rows.filter((r) => Number(r.data?.details?.sleeps || 0) >= s.guests!);
  if (s.bedrooms) rows = rows.filter((r) => Number(r.data?.details?.bedrooms || 0) >= s.bedrooms!);
  if (s.amenities?.length) rows = rows.filter((r) => s.amenities!.every((a) => (r.data?.features || []).includes(a)));
  if (s.minPrice != null) rows = rows.filter((r) => Number(r.data?.price) >= s.minPrice!);
  if (s.maxPrice != null) rows = rows.filter((r) => Number(r.data?.price) <= s.maxPrice!);
  if (s.startDate && s.endDate) {
    const checked = await Promise.all(rows.map(async (r) => {
      const a: any = await stowbo.availability(String(r.sk), { startDate: s.startDate!, endDate: s.endDate! }).catch(() => null);
      return a?.sufficient ? { ...r, data: { ...r.data, quote: a.quote, available: a.available } } : null;
    }));
    rows = checked.filter(Boolean) as MarketEnvelope[];
  }
  const ratings = await ratingsFor(rows.map((r) => String(r.sk)));
  rows = rows.map((r) => ({ ...r, rating: ratings[String(r.sk)] }));
  const price = (r: MarketEnvelope) => Number(r.data?.quote?.total ?? r.data?.price ?? Infinity);
  if (s.sort === "price_asc") rows.sort((a, b) => price(a) - price(b));
  else if (s.sort === "price_desc") rows.sort((a, b) => price(b) - price(a));
  else if (s.sort === "rating") rows.sort((a, b) => (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
  else rows.sort((a, b) => (b.rating?.average ?? 0) * Math.log2(2 + (b.rating?.count ?? 0)) - (a.rating?.average ?? 0) * Math.log2(2 + (a.rating?.count ?? 0)));
  return { rows, total: rows.length };
}

const STATES: Record<string, string> = { TX: "texas", OK: "oklahoma", TN: "tennessee", NC: "north carolina", FL: "florida", CA: "california", IL: "illinois", LA: "louisiana" };
function stateName(code?: string): string { return STATES[String(code || "").toUpperCase()] || ""; }

export interface ReviewRow { id: string; rating: number; title: string | null; message: string; at: string | null; author: string }
export interface Reviews { average: number | null; count: number; histogram: Record<string, number>; data: ReviewRow[] }

/** A listing's reviews: top-level comments on the listing that carry a rating. */
export async function listingReviews(listingId: string): Promise<Reviews> {
  try {
    const r: any = await listingComments(listingId, { pageSize: 100 });
    const rows = ((r?.data as any[]) || []).filter((c) => !c.data?.parentComment && typeof c.data?.rating === "number");
    const histogram: Record<string, number> = { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 };
    let sum = 0;
    for (const c of rows) { histogram[String(Math.round(c.data.rating))] += 1; sum += c.data.rating; }
    return {
      average: rows.length ? Math.round((sum / rows.length) * 100) / 100 : null,
      count: rows.length, histogram,
      data: rows.map((c) => ({ id: String(c.sk), rating: c.data.rating, title: c.data.title || null, message: c.data.message, at: c.createdate || null, author: String(c.view?.author || "Guest").split(" ")[0] })),
    };
  } catch {
    return { average: null, count: 0, histogram: {}, data: [] };
  }
}

export async function addReview(listingId: string, body: { rating: number; title?: string; message: string }) {
  return addListingComment(listingId, body);
}

/** Server quote → the shape the reserve card renders (rows straight from the server). */
export function toMarketQuote(q: CheckoutQuote | null | undefined): MarketQuote | null {
  if (!q) return null;
  const line: any = q.lines?.[0] || {};
  const rate = line.rateLines?.[0];
  return {
    total: Number(q.total ?? 0), subtotal: Number(q.subtotal ?? 0), tax: Number(q.tax ?? 0), currency: q.currency || "USD",
    rateLabel: rate?.label, rateMinutes: (line.rateLines || []).reduce((m: number, r: any) => m + Number(r.minutes || 0), 0), base: Number(line.base ?? q.subtotal ?? 0),
    fees: (q.fees || []).map((f) => ({ label: f.label, amount: Number(f.amount || 0), by: f.by, code: f.code })),
    discount: Number(q.discount || 0),
    freeUntil: line.cancellationPolicy?.freeUntil ?? null, policy: line.cancellationPolicy?.policy ?? null,
    bookable: q.bookable !== false && line.sufficient !== false,
    reason: line.fitReason || (q.unavailable?.[0]?.reason ?? null),
  };
}

/* ── host ── */

export interface HostTripRow {
  booking: string; reference?: string; status: string; listing?: string; listingId?: string | null; listingTitle?: string | null;
  image?: string | null; start?: string | null; end?: string | null; guest: { name: string; id?: string; email?: string };
  total: number; currency: string; paymentStatus?: string | null; at?: string | null;
}

/** Bookings on the host's listings in this vertical (GET host/bookings), each with the
 *  guest's contact card (GET host/bookings/:id/customer). */
export async function hostTrips(cfg: RentalsConfig): Promise<HostTripRow[]> {
  const [all, listings] = await Promise.all([stowbo.host.allBookings().catch(() => []), stowbo.host.listings().catch(() => null)]);
  const mine = new Map(((listings?.data || []) as MarketEnvelope[]).filter((l) => !cfg.vertical || l.data?.vertical === cfg.vertical).map((l) => [String(l.data?.name), l]));
  const picked = (all || []).filter((b) => b.listing && mine.has(String(b.listing)));
  const people = new Map<string, { name?: string; email?: string | null }>();
  await Promise.all(picked.map(async (b) => { const c: any = await stowbo.host.bookingCustomer(b.booking).catch(() => null); if (c) people.set(b.booking, c); }));
  return picked.map((b) => {
    const l = mine.get(String(b.listing))!;
    return {
      booking: b.booking, reference: b.reference, status: b.status, listing: b.listing || undefined, listingId: String(l.sk),
      listingTitle: b.listingTitle || l.data?.title, image: imageList(l.data?.images)[0] || null, start: b.start, end: b.end,
      guest: { name: people.get(b.booking)?.name || b.guest?.name || "Guest", id: b.customer, email: people.get(b.booking)?.email || undefined },
      total: b.total, currency: b.currency, paymentStatus: b.paymentStatus, at: b.at,
    };
  }).sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
}

/** The host fee records attached to one listing (GET host/listings/:id/fees). */
export async function listingFees(listingId: string): Promise<Envelope<any>[]> {
  return hostListingFees(listingId);
}

/** The vertical's listings a host owns (never the market listing itself). */
export async function myMarketListings(cfg: RentalsConfig): Promise<MarketEnvelope[]> {
  const res: any = await stowbo.host.listings().catch(() => null);
  return ((res?.data || []) as MarketEnvelope[]).filter((l) => !l.data?.marketRoot && l.data?.vertical === cfg.vertical);
}
