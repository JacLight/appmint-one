/**
 * Approximate coordinates for a listing. Real listings don't carry lat/lng yet, so we
 * derive a stable point from the city (+ a deterministic jitter from the record id so
 * pins in the same city don't stack). When hosts add real geo, prefer that.
 */
const CITY_COORDS: Record<string, [number, number]> = {
  "san francisco": [37.7749, -122.4194],
  berkeley: [37.8715, -122.273],
  oakland: [37.8044, -122.2712],
  hayward: [37.6688, -122.0808],
  richmond: [37.9358, -122.3477],
  "daly city": [37.6879, -122.4702],
  "san jose": [37.3382, -121.8863],
  "olympic valley": [39.197, -120.2357],
  austin: [30.2672, -97.7431],
};
const DEFAULT: [number, number] = [37.7749, -122.4194]; // SF Bay

export function listingCoords(sk: string, city?: string | null): { lat: number; lng: number } {
  const base = (city && CITY_COORDS[city.trim().toLowerCase()]) || DEFAULT;
  let h = 0;
  for (let i = 0; i < sk.length; i++) h = (h * 31 + sk.charCodeAt(i)) >>> 0;
  const jitterLat = (((h % 1000) / 1000) - 0.5) * 0.06; // ~±3km
  const jitterLng = ((((h >> 10) % 1000) / 1000) - 0.5) * 0.06;
  return { lat: base[0] + jitterLat, lng: base[1] + jitterLng };
}
