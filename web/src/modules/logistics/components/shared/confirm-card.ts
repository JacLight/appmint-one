"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { stripeKeyAction } from "@/modules/rentals/actions/checkout";

let stripeP: Promise<Stripe | null> | null = null;

/** The org's Stripe, from the same publishable key the card step mounted with. */
function getStripe(): Promise<Stripe | null> {
  if (!stripeP) {
    stripeP = stripeKeyAction().then((r) => (r.ok ? loadStripe(r.publishableKey) : null));
  }
  return stripeP;
}

/** Confirm the engine's PaymentIntent with the card the shared card step tokenised.
 *  Stripe runs any 3-D Secure challenge itself. */
export async function confirmCard(clientSecret: string, paymentMethodId: string): Promise<{ ok: true; paymentIntentId: string } | { ok: false; error: string }> {
  const stripe = await getStripe();
  if (!stripe) return { ok: false, error: "Card payment isn’t available right now — please try again shortly." };
  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, { payment_method: paymentMethodId });
  if (error) return { ok: false, error: error.message || "Your card was declined." };
  if (!paymentIntent || !["succeeded", "processing", "requires_capture"].includes(paymentIntent.status)) {
    return { ok: false, error: "Your card wasn’t charged. Please try again." };
  }
  return { ok: true, paymentIntentId: paymentIntent.id };
}
