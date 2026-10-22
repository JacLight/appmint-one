"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { getSetup } from "@/lib/setup";
import { completeDeliveryPayment, createDeliveryOrder } from "@/api/logistics";
import { storeView, ORDERS } from "../lib/config";
import { currentCart, forgetCart } from "../lib/cart-cookie";
import { cartIntent, getRestaurant, placeOrder } from "@/api/store";
import { deliveryFee, jobNote, setDeliveryAddress } from "../lib/food";

/* ═════════════════════════════ food ═════════════════════════════ */

/** The /eat address bar. */
export async function setEatAddressAction(address: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = address.trim();
  if (a.length < 6 || !/\d/.test(a)) return { ok: false, error: "Enter a street address with a number." };
  await setDeliveryAddress(a);
  revalidatePath("/eat", "layout");
  return { ok: true };
}

export type FoodPrep =
  | { ok: true; clientSecret: string; foodTotal: number; fee: number }
  | { ok: false; error: string; changed?: boolean; signIn?: boolean };

/**
 * Step 1 of a food order, before any card is touched: re-read the basket and re-quote
 * the delivery; both must still be what the customer was shown. Then the PaymentIntent
 * for the food (the engine checks it against the stored basket).
 */
export async function foodPrepareAction(address: string, shown: { food: number; fee: number }): Promise<FoodPrep> {
  try {
    const session = await getSession();
    if (!session.signedIn || !session.customer?.email) return { ok: false, error: "Sign in to order.", signIn: true };
    const view = storeView(await getSetup());
    const cart = await currentCart("food");
    if (!cart?.lines.length || !cart.restaurant) return { ok: false, error: "Your basket is empty." };
    const r = await getRestaurant(view.foodTag, cart.restaurant);
    if (!r) return { ok: false, error: "This restaurant isn’t taking orders right now." };
    const fee = await deliveryFee(r, address);
    if (!fee.ok) return { ok: false, error: fee.error };
    if (Math.abs(cart.totals.total - shown.food) > 0.004 || Math.abs(fee.quote.amount - shown.fee) > 0.004) {
      return { ok: false, changed: true, error: "Prices changed since you opened checkout. Check the new total." };
    }
    const pi = await cartIntent(cart.id, cart.totals.total, session.customer.email);
    if (!pi?.client_secret) return { ok: false, error: "We couldn’t start the payment." };
    return { ok: true, clientSecret: pi.client_secret, foodTotal: cart.totals.total, fee: fee.quote.amount };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t start your order.") };
  }
}

export type FoodPlaced =
  | { ok: true; orderNumber: string; jobId?: string; deliverySecret?: string; deliveryAmount?: number; deliveryError?: string }
  | { ok: false; error: string };

/**
 * Step 2, after the food payment was confirmed: write the store order, then book the
 * courier with POST client/logistics/orders (pickup at the restaurant, drop-off at the
 * customer). The delivery card is only confirmed when the order's own price is the fee
 * the customer was shown (`input.fee`); otherwise the job waits unpaid and the order page
 * offers to pay its price. A courier booking that fails leaves the paid order in place.
 */
export async function foodPlaceAction(input: { address: string; dropoff: { instructions?: string; handTo: boolean }; paymentIntentId: string; fee: number }): Promise<FoodPlaced> {
  const session = await getSession();
  if (!session.signedIn || !session.customer?.email) return { ok: false, error: "Sign in to order." };
  const c = session.customer;
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email;
  const view = storeView(await getSetup());
  const cart = await currentCart("food");
  if (!cart?.lines.length || !cart.restaurant) return { ok: false, error: "Your basket is empty." };
  const r = await getRestaurant(view.foodTag, cart.restaurant);
  if (!r) return { ok: false, error: "This restaurant isn’t taking orders right now." };
  const parts = input.address.split(",").map((s) => s.trim());
  const sz = (parts[parts.length - 1] || "").match(/([A-Za-z]{2})\s+(\d{5})/);
  let orderNumber = "";
  try {
    const order: any = await placeOrder({
      cartId: cart.id, email: c.email, name, phone: c.phone,
      shippingAddress: { name, street1: parts[0] || input.address, city: parts[1] || "", state: sz?.[1] || "", zip: sz?.[2] || "", country: "US", phone: c.phone },
      paymentRef: input.paymentIntentId,
    });
    orderNumber = String(order?.data?.number || order?.number || "");
    if (!orderNumber) return { ok: false, error: "Your payment went through but the order didn’t save. Contact support with your receipt." };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t place your order.") };
  }
  await forgetCart("food");
  revalidatePath(ORDERS);

  const instructions = [input.dropoff.handTo ? "Hand it to me" : "Leave at door", input.dropoff.instructions?.trim()].filter(Boolean).join(" · ");
  try {
    const fee = await deliveryFee(r, input.address);
    if (!fee.ok) return { ok: true, orderNumber, deliveryError: fee.error };
    const stops = fee.quote.stops.map((s) => ({ ...s, ...(s.type === "dropoff" ? { instructions, contact: { name, phone: c.phone || "" } } : { contact: { name: r.title, phone: r.phone || "" } }) }));
    const o = await createDeliveryOrder({ stops, notes: jobNote(orderNumber, r.title), paymentMethod: "stripe" });
    const jobId = String(o?.job?.sk || "");
    const amount = Number(o?.pricing?.customerPays ?? o?.payment?.amount ?? 0);
    if (!jobId || !o.clientSecret) return { ok: true, orderNumber, deliveryError: "We couldn’t book the courier yet." };
    // Never confirm the delivery card for an amount the customer wasn't shown.
    if (Math.abs(amount - input.fee) > 0.004) return { ok: true, orderNumber, jobId };
    return { ok: true, orderNumber, jobId, deliverySecret: o.clientSecret, deliveryAmount: amount };
  } catch (e) {
    return { ok: true, orderNumber, deliveryError: getErrorMessage(e, "We couldn’t book the courier yet.") };
  }
}

/** Step 3: the delivery payment was confirmed — the engine verifies it and releases
 *  the job to couriers. */
export async function foodDeliveryPaidAction(jobId: string, paymentIntentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await completeDeliveryPayment(jobId, paymentIntentId);
    revalidatePath(ORDERS);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "The delivery payment didn’t go through.") };
  }
}

