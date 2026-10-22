import { stowbo, type ListingCard } from "@/api/rentals";
import { ListingCardGrid } from "@/modules/rentals/components/listing/more-from-host";

function imageUrl(images: unknown): string | undefined {
  if (!Array.isArray(images)) return undefined;
  const f = images.find((x) => typeof x === "string" || (x && typeof x === "object" && "url" in x));
  return typeof f === "string" ? f : (f as { url?: string })?.url;
}
function milesKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Same-kind places near this listing. Prefers the `nearby` endpoint; on older prod
 *  falls back to a browse of the same spaceType ranked by distance from the anchor. */
export async function NearbyAlternatives({
  listingId, spaceType, lat, lng, excludeSk,
}: { listingId: string; spaceType?: string; lat?: number; lng?: number; excludeSk: string }) {
  // 1. The real endpoint (radius search, availability-aware). NOTE: it returns full
  //    listing envelopes (owner stripped), not flat cards — flatten row.data here.
  const viaEndpoint = await stowbo.nearby(listingId, { radiusKm: 25, pageSize: 6 }).catch(() => null);
  if (viaEndpoint?.data?.length) {
    const cards: ListingCard[] = viaEndpoint.data.map((l) => {
      const x: any = l.data ?? {};
      return { sk: l.sk, title: x.title, spaceType: x.spaceType, city: x.address?.city, image: imageUrl(x.images), price: x.price, priceUnit: x.priceUnit, distanceKm: x.distanceKm };
    });
    return <ListingCardGrid title="Nearby alternatives" cards={cards} />;
  }
  // 2. Fallback: same-type browse ranked by distance (needs the anchor's coords).
  if (lat == null || lng == null) return null;
  const origin = { lat, lng };
  const all = await stowbo.listings({ spaceType, pageSize: 200 }).catch(() => null);
  const cards: ListingCard[] = (all?.data ?? [])
    .map((l) => {
      const x: any = l.data ?? {};
      const loc = x.location;
      const d = loc?.lat != null && loc?.lng != null ? milesKm(origin, { lat: Number(loc.lat), lng: Number(loc.lng) }) : Infinity;
      return { l, x, d };
    })
    .filter(({ l, x, d }) => l.sk !== excludeSk && !x.parent && (x.status ?? "active") === "active" && x.spaceType === spaceType && d <= 25)
    .sort((a, b) => a.d - b.d)
    .slice(0, 6)
    .map(({ l, x, d }) => ({ sk: l.sk, title: x.title, spaceType: x.spaceType, city: x.address?.city, image: imageUrl(x.images), price: x.price, priceUnit: x.priceUnit, distanceKm: Number.isFinite(d) ? d : undefined }));
  return <ListingCardGrid title="Nearby alternatives" cards={cards} />;
}
