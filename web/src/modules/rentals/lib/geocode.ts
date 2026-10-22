/**
 * Server-side geocoding via Google's Geocoding API (the org key from shipping/google-keys
 * has it enabled — it's what shipping uses). Results are cached in-process by address so a
 * listing is geocoded once, not on every browse. Falls back to null on any failure.
 */
const cache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodeAddress(address: string, key: string): Promise<{ lat: number; lng: number } | null> {
  const q = (address || "").trim();
  if (!q || !key) return null;
  if (cache.has(q)) return cache.get(q)!;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${key}`;
    const r = await fetch(url);
    const j: any = await r.json();
    const loc = j?.results?.[0]?.geometry?.location;
    const out = loc && typeof loc.lat === "number" ? { lat: loc.lat, lng: loc.lng } : null;
    cache.set(q, out);
    return out;
  } catch {
    cache.set(q, null);
    return null;
  }
}

/** Compose a geocodable one-line address from a listing's address object. */
export function addressString(a?: {
  street1?: string; street2?: string; city?: string; state?: string; zip?: string; country?: string;
}): string {
  if (!a) return "";
  return [a.street1, a.city, a.state, a.zip, a.country].filter(Boolean).join(", ");
}
