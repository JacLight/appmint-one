/**
 * Food delivery on top of Logistics: a restaurant is a merchant selling through the
 * store, and Logistics carries its orders. The delivery fee from the restaurant to the
 * customer's address is the Logistics quote (modules/logistics/pricing.ts getQuote: the
 * engine's fixed price, the one POST client/logistics/orders charges), and the courier job
 * is booked with that route once the food is paid (actions/checkout.ts foodPlaceAction).
 */
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getQuote, QuoteError, type Quote } from "@/modules/logistics/pricing";
import type { DeliveryRequest } from "@/modules/logistics/lib/request";
import { myDeliveryOrders } from "@/api/logistics";
import type { JobEnvelope } from "@/modules/logistics/lib/types";
import type { Restaurant } from "./types";

const ADDR = "st_addr";

/** Where the customer wants food delivered (set from the /eat address bar). */
export async function deliveryAddress(): Promise<string | undefined> {
  const v = (await cookies()).get(ADDR)?.value;
  return v ? decodeURIComponent(v) : undefined;
}
export async function setDeliveryAddress(address: string) {
  (await cookies()).set(ADDR, encodeURIComponent(address.trim().slice(0, 200)), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180, secure: process.env.NODE_ENV === "production" });
}

export function deliveryRequest(r: Restaurant, address: string, contact?: { name?: string; phone?: string; instructions?: string }): DeliveryRequest {
  return {
    kind: "package", size: "small", when: "now",
    pickup: { address: r.address, contactName: r.title, contactPhone: r.phone },
    dropoff: { address, contactName: contact?.name, contactPhone: contact?.phone, instructions: contact?.instructions },
  };
}

export type FeeResult = { ok: true; quote: Quote } | { ok: false; error: string };

/** The delivery fee (and route time) from this restaurant to `address`. */
export const deliveryFee = cache(async (r: Restaurant, address: string): Promise<FeeResult> => {
  try {
    return { ok: true, quote: await getQuote(deliveryRequest(r, address)) };
  } catch (e: any) {
    if (e instanceof QuoteError) return { ok: false, error: e.field === "pickup" ? "This kitchen isn’t taking deliveries right now." : e.message };
    return { ok: false, error: "We couldn’t price delivery right now." };
  }
});

/** "Order #N · Restaurant" — how a courier job names the store order it carries. */
export const jobNote = (orderNumber: string, restaurant: string) => `Order #${orderNumber} · ${restaurant}`;

/** The courier job carrying this store order, from the customer's own jobs. */
export async function jobForOrder(orderNumber: string): Promise<JobEnvelope | null> {
  const r: any = await myDeliveryOrders({ pageSize: 100 }).catch(() => null);
  const list: JobEnvelope[] = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];
  const tag = `Order #${orderNumber} ·`;
  return list.find((j) => String(j?.data?.notes || "").startsWith(tag)) || null;
}

/** Minutes until it arrives: the kitchen's prep time + the drive. */
export function etaRange(r: Restaurant, q?: Quote | null): [number, number] | null {
  const [a, b] = r.prep || [15, 25];
  const drive = q?.route?.minutes ?? null;
  if (drive == null) return null;
  return [Math.round(a + drive), Math.round(b + drive + 5)];
}
