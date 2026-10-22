import "server-only";
import { cache } from "react";
import { googleKeys } from "@/api/rentals";
import { runtimeEnv } from "@/lib/runtime-env";

/**
 * The org's Google Maps API key, from appengine `GET /shipping/google-keys`
 * → { mapsApiKey, source, billable }. Cached per request. Falls back only to a key
 * the deployment supplies at RUNTIME (GOOGLE_MAPS_KEY) — nothing is baked in.
 */
export const getMapsKey = cache(async (): Promise<string | null> => {
  try {
    const res = await googleKeys();
    if (res?.mapsApiKey) return res.mapsApiKey;
  } catch {
    /* appengine has no billable key (e.g. 402) — fall through to the deployment's key */
  }
  return runtimeEnv("GOOGLE_MAPS_KEY") || runtimeEnv("NEXT_PUBLIC_GOOGLE_MAPS_KEY") || null;
});
