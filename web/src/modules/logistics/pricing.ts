/**
 * THE pricing step for Logistics. Every price a screen shows comes from `getQuote`:
 * pickup, drop-off, size and time go in; one fixed amount comes out, and that amount
 * is what the order is charged.
 *
 * It is two existing appengine routes (src/logistics/delivery-client.controller.ts):
 *
 *   1. POST client/logistics/quote/validated: geocodes both addresses and checks
 *      they are inside the service area. Only its stops/errors are used. Its price
 *      is NOT used: it applies the pickup zone's pricing, which the order route does not.
 *   2. POST client/logistics/quote with the address-only stops: the org's delivery
 *      config priced with calculateJobPricing and no zone, which is the same calculation
 *      POST client/logistics/orders runs for the job and its Stripe PaymentIntent. Sending
 *      no coordinates keeps the quote route from looking up a zone, so both match exactly.
 *
 * The order step (actions/customer.ts) still compares the order's own amount with this
 * one before any card is confirmed.
 */
import "server-only";
import { priceStops, validateStops, type ValidatedQuote } from "@/api/logistics";
import { toStops, itemDescription, type DeliveryRequest } from "./lib/request";
import type { JobStop } from "./lib/types";

export interface Quote {
  /** The price to pay, in major units (14.8 = $14.80). */
  amount: number;
  currency: string;
  /** What is being booked ("Ride · Standard · 1 rider"). */
  label: string;
  /** Route facts for display ("1.6 mi · 9 min"). */
  route?: { miles: number; minutes: number };
  /** The stops exactly as priced (typed address + geocoded point), handed to the order unchanged. */
  stops: JobStop[];
  pickupAddress: string;
  dropoffAddress: string;
}

export class QuoteError extends Error {
  constructor(message: string, public field?: "pickup" | "dropoff") { super(message); }
}

const clean = (s?: string) => (s || "").replace(/, USA$/, "");

/** Turn the engine's per-stop errors / unserviceable flags into one clear message. */
function rejectInvalid(v: ValidatedQuote, base: JobStop[]): void {
  if (v?.valid && v.stops?.length) {
    const unserved = v.stops.find((s) => s.serviceable === false);
    if (unserved) throw new QuoteError(`We don’t cover that ${unserved.type === "dropoff" ? "drop-off" : "pickup"} address yet.`, unserved.type);
    return;
  }
  const e = v?.errors?.[0];
  const field = e ? base[e.stopIndex]?.type : undefined;
  const msg = (e?.errors ?? []).join(" ");
  const where = field === "dropoff" ? "drop-off" : "pickup";
  if (/serv|zone|area|outside/i.test(msg)) throw new QuoteError(`We don’t cover that ${where} address yet.`, field);
  throw new QuoteError(`We couldn’t find that ${where} address. Check the street and city.`, field);
}

export async function getQuote(request: DeliveryRequest): Promise<Quote> {
  if (!request.pickup.address?.trim()) throw new QuoteError("Add a pickup address.", "pickup");
  if (!request.dropoff.address?.trim()) throw new QuoteError("Add a drop-off address.", "dropoff");
  const base = toStops(request);
  const addrOnly = base.map((s) => ({ type: s.type, location: { address: s.location.address } }));

  const v = await validateStops(addrOnly);
  rejectInvalid(v, base);
  const q = await priceStops(addrOnly);
  const amount = Number(q?.customerPays);
  if (!(amount > 0)) throw new QuoteError("We couldn’t price that route right now. Try again in a moment.");

  const at = (type: "pickup" | "dropoff") => v.stops?.find((s) => s.type === type)?.location;
  const pu = at("pickup"), dr = at("dropoff");
  return {
    amount,
    currency: String(q?.pricing?.currency || "USD"),
    label: itemDescription(request),
    route: { miles: Number(q?.distance ?? 0), minutes: Math.round(Number(q?.duration ?? 0)) },
    stops: toStops(request, {
      pickup: pu ? { lat: pu.lat, lng: pu.lng } : undefined,
      dropoff: dr ? { lat: dr.lat, lng: dr.lng } : undefined,
    }),
    pickupAddress: clean(pu?.formattedAddress) || request.pickup.address,
    dropoffAddress: clean(dr?.formattedAddress) || request.dropoff.address,
  };
}

