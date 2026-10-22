"use client";

import { BrowseMap } from "@/modules/rentals/market/browse-map";
import type { Home } from "../lib/types";

/** One home's pin, on the same map the browse page uses. */
export function HomeMap({ home, mapsKey }: { home: Home; mapsKey: string | null }) {
  return (
    <BrowseMap
      single
      mapsKey={mapsKey}
      basePath="/homes"
      cards={[{ id: home.id, title: home.title, type: home.type, typeLabel: home.type, city: home.neighborhood, state: home.address?.state || "", image: home.images[0] || null, images: [], price: null, unit: "", facts: [], rating: { average: null, count: 0 }, lat: home.lat, lng: home.lng }]}
    />
  );
}
