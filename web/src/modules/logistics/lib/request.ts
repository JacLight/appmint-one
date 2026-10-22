/**
 * What a customer asks for — the request form's shape and the options it offers.
 * One request drives both the quote (pricing.ts getQuote) and the order, so the
 * price is always for exactly what is being booked. Size and riders are details on the
 * pickup item; the engine's price depends on the route only. Client-safe.
 */
import type { JobStop } from "./types";

export type RequestKind = "package" | "ride";

export const PACKAGE_SIZES = [
  { id: "small", label: "Small", detail: "Fits in a backpack — documents, keys, a phone", weight: 5 },
  { id: "medium", label: "Medium", detail: "Fits on a car seat — a box, a few bags", weight: 25 },
  { id: "large", label: "Large", detail: "Needs the trunk or a hatchback — a TV, a suitcase", weight: 60 },
] as const;

export type PackageSize = (typeof PACKAGE_SIZES)[number]["id"];

export interface DeliveryRequest {
  kind: RequestKind;
  pickup: { address: string; contactName?: string; contactPhone?: string; instructions?: string };
  dropoff: { address: string; contactName?: string; contactPhone?: string; instructions?: string };
  size?: PackageSize;
  riders?: number;
  /** "now" or an ISO date-time for a scheduled pickup. */
  when: "now" | string;
  notes?: string;
}

export function itemDescription(r: DeliveryRequest): string {
  if (r.kind === "ride") {
    const n = Math.max(1, r.riders || 1);
    return `Ride · Standard · ${n} ${n === 1 ? "rider" : "riders"}`;
  }
  const s = PACKAGE_SIZES.find((x) => x.id === r.size) ?? PACKAGE_SIZES[0];
  return `${s.label} package`;
}

/** The engine's stop list for this request. Size / ride type travel as the pickup's
 *  item; the time travels as the pickup's `timeWindow` (a schema field on the stop —
 *  the client order route has no top-level `scheduling`). */
export function toStops(r: DeliveryRequest, coords?: { pickup?: { lat: number; lng: number }; dropoff?: { lat: number; lng: number } }): JobStop[] {
  const size = PACKAGE_SIZES.find((x) => x.id === r.size);
  const contact = (name?: string, phone?: string) => (name?.trim() || phone?.trim() ? { name: name?.trim() || "", phone: phone?.trim() || "" } : undefined);
  return [
    {
      type: "pickup",
      location: { address: r.pickup.address.trim(), ...(coords?.pickup ?? {}) },
      contact: contact(r.pickup.contactName, r.pickup.contactPhone),
      instructions: r.pickup.instructions?.trim() || undefined,
      items: [{ description: itemDescription(r), quantity: r.kind === "ride" ? Math.max(1, r.riders || 1) : 1, ...(r.kind === "package" && size ? { weight: size.weight } : {}) }],
      timeWindow: r.when === "now" ? { type: "asap" } : { type: "scheduled", scheduledAt: r.when },
    },
    {
      type: "dropoff",
      location: { address: r.dropoff.address.trim(), ...(coords?.dropoff ?? {}) },
      contact: contact(r.dropoff.contactName, r.dropoff.contactPhone),
      instructions: r.dropoff.instructions?.trim() || undefined,
    },
  ];
}
