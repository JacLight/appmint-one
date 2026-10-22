"use server";

import { stowbo, type ListingDetail } from "@/api/rentals";
import { getSession } from "@/lib/auth";
import { classLabel } from "@/modules/rentals/lib/classes";
import type { PanelAddOn, PanelSpot, PanelAvailability, PanelPayment } from "@/modules/rentals/components/listing/booking-panel";

function imageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" && "url" in x ? (x as { url?: string }).url : undefined))
    .filter((u): u is string => !!u);
}
const UNIT_NOUN: Record<string, string> = {
  parking: "spot", locker: "locker", "box-storage": "box", "shared-space": "space",
  warehouse: "bay", "spare-room": "room", "cold-storage": "unit", "bike-gear": "slot", "event-bag-drop": "bag",
};

export type QuickView = {
  id: string;
  title: string;
  classLabel: string;
  location: string;
  staffing: string;
  capacity?: number;
  size?: string;
  description?: string;
  photos: string[];
  hostName?: string;
  panel: {
    price?: number; priceUnit?: string; capacity: number; unitNoun: string;
    addOns: PanelAddOn[]; spots: PanelSpot[]; signedIn: boolean; timeOfDay: boolean;
    availability?: PanelAvailability; payment?: PanelPayment;
  };
};

/** Everything the browse quick-view drawer needs to render a listing preview
 *  AND host the real booking panel — the same mapping the full listing page uses,
 *  so the drawer books identically without a page navigation. */
export async function quickViewAction(id: string): Promise<QuickView | null> {
  const detail = (await stowbo.listing(id).catch(() => null)) as ListingDetail | null;
  if (!detail?.listing) return null;
  const d: any = detail.listing.data;
  const spots = detail.children ?? [];
  const addOns = detail.addOns ?? [];
  const session = await getSession();
  const unitNoun = (d?.unitLabel as string) || UNIT_NOUN[d?.spaceType ?? ""] || "unit";

  const panelAddOns: PanelAddOn[] = addOns
    .map((a: any) => ({ name: a.data?.name, title: a.data?.title || a.data?.name, price: a.data?.price, chargeEvery: a.data?.chargeEvery }))
    .filter((a: PanelAddOn) => a.name);
  const panelSpots: PanelSpot[] = spots.map((s: any) => ({
    sk: s.sk, title: s.data?.title || s.data?.spaceType || "Spot",
    price: s.data?.price, priceUnit: s.data?.priceUnit, capacity: s.data?.capacity ?? 1,
  }));
  const timeOfDay = d?.spaceType === "event-bag-drop" || d?.priceUnit === "hour" || panelSpots.some((s) => s.priceUnit === "hour");
  const host = detail.host ?? (d?.hostName ? { displayName: d.hostName as string } : null);

  return {
    id,
    title: d?.title || "Space",
    classLabel: classLabel(d?.spaceType),
    location: [d?.address?.city, d?.address?.state].filter(Boolean).join(", ") || "—",
    staffing: d?.staffing === "manned" ? "Staffed" : "Self-serve",
    capacity: d?.capacity,
    size: d?.size,
    description: d?.description,
    photos: imageUrls(d?.images),
    hostName: host?.displayName,
    panel: {
      price: d?.price, priceUnit: d?.priceUnit, capacity: d?.capacity ?? 1, unitNoun,
      addOns: panelAddOns, spots: panelSpots, signedIn: session.signedIn, timeOfDay,
      availability: d?.availability, payment: d?.payment,
    },
  };
}
