/**
 * Logistics: the food-delivery leg. Fixed-price quote, the courier order and its
 * payment, tracking, cancel/refund, rating. appengine `client/logistics/*`
 * (/Users/imzee/projects/appengine/src/logistics/delivery-client.controller.ts).
 *
 * Pricing rule (verified live 2026-10-21): POST client/logistics/quote with
 * address-only stops runs the same calculation POST client/logistics/orders charges
 * (org delivery config, no zone); quote/validated adds the pickup zone's pricing,
 * which orders does not charge, so only its geocoding and service-area check are used.
 */
import "server-only";
import { apiReq, type Paged } from "@/lib/api";
import type { JobEnvelope, JobStop, TrackView } from "@/modules/logistics/lib/types";

const P = "client/logistics";
const enc = encodeURIComponent;

export type StopInput = Pick<JobStop, "type" | "location">;

export interface ValidatedQuote {
  valid: boolean;
  errors?: { stopIndex: number; type: string; errors: string[] }[];
  quote?: { customerPays: number; distance: number; duration: number; routeSource?: string; pricing?: { currency?: string; total?: number } };
  stops?: { type: "pickup" | "dropoff"; location: { lat: number; lng: number; formattedAddress?: string }; zone?: string; serviceable: boolean }[];
}

export interface PriceQuote { customerPays: number; distance?: number; duration?: number; pricing?: { currency?: string; total?: number } }

export interface OrderCreated {
  job: JobEnvelope;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentIntentId?: string;
  payment?: { amount?: number; currency?: string; status?: string };
  pricing?: { customerPays: number; distance?: number; duration?: number };
}

/* ── pricing (modules/logistics/pricing.ts getQuote is the only caller) ── */

/** POST client/logistics/quote/validated: geocode + service-area check. */
export const validateStops = (stops: StopInput[]) =>
  apiReq<ValidatedQuote>("POST", `${P}/quote/validated`, { data: { stops } });

/** POST client/logistics/quote: the price POST orders charges for these stops. */
export const priceStops = (stops: StopInput[]) =>
  apiReq<PriceQuote>("POST", `${P}/quote`, { data: { stops } });

/* ── orders ── */

/** POST client/logistics/orders: prices the stops, creates the job (awaiting_payment)
 *  and a Stripe PaymentIntent for exactly `pricing.customerPays`. */
export const createDeliveryOrder = (data: { stops: JobStop[]; notes?: string; paymentMethod: "stripe" }) =>
  apiReq<OrderCreated>("POST", `${P}/orders`, { data });

/** POST client/logistics/orders/:id/complete-payment: verifies the intent, releases the job. */
export const completeDeliveryPayment = (jobId: string, paymentIntentId: string) =>
  apiReq<{ success: boolean; job: JobEnvelope; payment: any }>("POST", `${P}/orders/${enc(jobId)}/complete-payment`, { data: { paymentMethod: "stripe", paymentIntentId } });

/** POST client/logistics/orders/:id/payment-intent: a fresh intent at the job's own price. */
export const deliveryPaymentIntent = (jobId: string) =>
  apiReq<{ clientSecret: string; paymentIntentId: string; amount: number }>("POST", `${P}/orders/${enc(jobId)}/payment-intent`, { data: {} });

/** GET client/logistics/orders: the customer's delivery jobs. */
export const myDeliveryOrders = (q?: { status?: string; page?: number; pageSize?: number }) =>
  apiReq<Paged<JobEnvelope>>("GET", `${P}/orders`, { query: q });

/** GET client/logistics/jobs/:id */
export const getDeliveryJob = (jobId: string) => apiReq<JobEnvelope>("GET", `${P}/jobs/${enc(jobId)}`);

/** GET client/logistics/orders/:id/track: driver card + live location. */
export const trackDelivery = (jobId: string) => apiReq<TrackView>("GET", `${P}/orders/${enc(jobId)}/track`);

/** PUT client/logistics/orders/:id/cancel: cancels and refunds by status. */
export const cancelDelivery = (jobId: string, reason?: string) =>
  apiReq<{ success: boolean; cancellation?: any; refund?: any }>("PUT", `${P}/orders/${enc(jobId)}/cancel`, { data: { reason: reason || "Cancelled by customer" } });

/** POST client/logistics/orders/:id/rate */
export const rateDelivery = (jobId: string, rating: number, comment?: string) =>
  apiReq<{ success: boolean; rating: any }>("POST", `${P}/orders/${enc(jobId)}/rate`, { data: { rating, comment } });

/** POST client/logistics/jobs/:id/issues */
export const reportDeliveryIssue = (jobId: string, data: { type: string; description?: string; photos?: any[] }) =>
  apiReq<any>("POST", `${P}/jobs/${enc(jobId)}/issues`, { data });

/** A `Paged` or a bare array → the rows. */
export function rows<T>(r: Paged<T> | T[] | null | undefined): T[] {
  if (!r) return [];
  return Array.isArray(r) ? r : Array.isArray((r as Paged<T>).data) ? (r as Paged<T>).data : [];
}
