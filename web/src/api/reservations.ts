/**
 * Reservations (scheduling): every engine call for classes, appointments and
 * consultations. A booking is a reservation of a reservation definition
 * (appengine src/crm/reservations.controller.ts, src/client-account/*). Memberships and
 * class packs are storefront subscriptions; intake forms are client/forms; invoices are
 * client-data/pay. Responses are returned as the engine sends them; screens map them.
 */
import "server-only";
import { apiReq } from "@/lib/api";

const enc = encodeURIComponent;

/** An engine record: `sk` is the id, `data` the fields. */
export interface EngineRecord<T = Record<string, any>> {
  sk: string;
  pk?: string;
  name?: string;
  data: T;
  createdate?: string;
  modifydate?: string;
  author?: string;
}

export interface ReservationService { name: string; duration?: number; price?: number; description?: string; capacity?: number }

export interface ReservationDefinition {
  name: string;
  title?: string;
  description?: string;
  status?: string;
  timezone?: string;
  services?: ReservationService[];
  hosts?: string | string[];
  form?: string;
  [k: string]: any;
}

export interface Reservation {
  name: string; // the booking number
  reservationDefinitionId: string;
  service?: string;
  startTime: string;
  endTime: string;
  status: "new" | "pending" | "confirmed" | "used" | "rescheduled" | "cancelled" | "no_show" | string;
  hosts?: string | string[];
  customer?: { name?: string; email?: string; phone?: string };
  notes?: string;
  intake?: Record<string, string>;
  rescheduleHistory?: { fromStartTime: string; toStartTime: string; at: string; by?: string; byCustomer?: boolean; reason?: string }[];
  cancelledAt?: string; cancelledBy?: string; cancelReason?: string; usedAt?: string;
  [k: string]: any;
}

export interface AvailabilityDay {
  date: string;
  closed?: boolean;
  hostOnLeave?: boolean;
  slots: { startTime: string; endTime: string; spotsTotal: number; spotsAvailable: number; [k: string]: any }[];
  [k: string]: any;
}

export interface AvailabilityResponse { service?: string; timezone?: string; nextAvailable?: string | null; days: AvailabilityDay[] }

export interface BookInput {
  reservationDefinitionId: string;
  service?: string;
  startTime: string;
  hosts?: string;
  customer: { name: string; email: string; phone?: string };
  notes?: string;
  intake?: Record<string, string>;
}

const rows = <T>(r: any): T[] => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []);

// ───────── public ─────────

/** GET crm/reservations/definitions — every active booking type (public). */
export async function listDefinitions(): Promise<EngineRecord<ReservationDefinition>[]> {
  return rows(await apiReq("GET", "crm/reservations/definitions"));
}

/** POST crm/reservations/availability — open times for a definition (public). */
export async function getAvailability(q: {
  reservationDefinitionId: string; serviceName?: string; from?: string; days?: number; host?: string; excludeReservationId?: string;
}): Promise<AvailabilityResponse> {
  return apiReq("POST", "crm/reservations/availability", { data: q });
}

/** POST crm/reservations/book — a visitor books without an account (name + email). */
export async function bookAsGuest(input: BookInput): Promise<EngineRecord<Reservation>> {
  return apiReq("POST", "crm/reservations/book", { data: input });
}

/** GET crm/reservations/by-email/:email/:number — a guest finds their booking. */
export async function findByEmail(email: string, number: string): Promise<EngineRecord<Reservation>[]> {
  return rows(await apiReq("GET", `crm/reservations/by-email/${enc(email)}/${enc(number)}`));
}

/** DELETE crm/reservations/cancel/:email/:number — the customer's cancel (record kept, marked cancelled). */
export async function cancelByEmail(email: string, number: string, reason?: string): Promise<any> {
  return apiReq("DELETE", `crm/reservations/cancel/${enc(email)}/${enc(number)}`, reason ? { data: { reason } } : {});
}

/** POST crm/reservations/reschedule/:email/:number — a guest moves their booking (409 when taken). */
export async function rescheduleByEmail(email: string, number: string, startTime: string, reason?: string): Promise<any> {
  return apiReq("POST", `crm/reservations/reschedule/${enc(email)}/${enc(number)}`, { data: { startTime, reason } });
}

/** GET client/forms/:name — a definition's intake form (public). */
export async function getForm(name: string): Promise<any> {
  return apiReq("GET", `client/forms/${enc(name)}`);
}

/** POST client/forms/:name/submit — answer a form. */
export async function submitForm(name: string, values: Record<string, any>): Promise<any> {
  return apiReq("POST", `client/forms/${enc(name)}/submit`, { data: values });
}

/** GET storefront/subscriptions/plans — memberships and class packs on sale (public). */
export async function listPlans(): Promise<EngineRecord[]> {
  return rows(await apiReq("GET", "storefront/subscriptions/plans"));
}

// ───────── the signed-in customer ─────────

/** POST client-data/reservations — the signed-in customer books. */
export async function bookReservation(input: BookInput): Promise<EngineRecord<Reservation>> {
  return apiReq("POST", "client-data/reservations", { data: input });
}

/** GET client-data/reservations — my bookings. */
export async function myReservations(): Promise<EngineRecord<Reservation>[]> {
  return rows(await apiReq("GET", "client-data/reservations"));
}

/** GET client-data/reservations/:id — one of my bookings (404 for anyone else's). */
export async function myReservation(id: string): Promise<EngineRecord<Reservation> | null> {
  const r: any = await apiReq("GET", `client-data/reservations/${enc(id)}`);
  return r?.sk ? r : r?.data?.sk ? r.data : null;
}

/** POST crm/reservations/reschedule/:id — the signed-in customer moves a booking (409 when taken). */
export async function rescheduleReservation(id: string, startTime: string, reason?: string): Promise<any> {
  return apiReq("POST", `crm/reservations/reschedule/${enc(id)}`, { data: { startTime, reason } });
}

/** GET client-data/forms — forms I've answered or still owe. */
export async function myFormSubmissions(limit = 100): Promise<any[]> {
  return rows(await apiReq("GET", "client-data/forms", { query: { limit } }));
}

/** GET client-data/all — my account summary; scheduling reads `invoices`. */
export async function myAccountData(): Promise<{ invoices?: any[]; [k: string]: any }> {
  return apiReq("GET", "client-data/all");
}

/** GET storefront/subscriptions/get/me — my memberships and packs. */
export async function mySubscriptions(): Promise<EngineRecord[]> {
  return rows(await apiReq("GET", "storefront/subscriptions/get/me"));
}

/** POST storefront/subscriptions/subscribe — the engine prices the plan and charges the card. */
export async function subscribe(body: { plan: string; paymentMethodId: string; autoRenew: boolean }): Promise<any> {
  return apiReq("POST", "storefront/subscriptions/subscribe", { data: body });
}

/** POST client-data/pay/:id/intent — a payment intent for what the engine says is owed. */
export async function invoicePaymentIntent(invoiceId: string): Promise<any> {
  return apiReq("POST", `client-data/pay/${enc(invoiceId)}/intent`, { data: {} });
}

/** POST client-data/pay/:id — record what the gateway charged against the invoice. */
export async function recordInvoicePayment(invoiceId: string, body: { gateway: string; ref: string; method: string }): Promise<any> {
  return apiReq("POST", `client-data/pay/${enc(invoiceId)}`, { data: body });
}
