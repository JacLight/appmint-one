import "server-only";
/**
 * Events (Event Oxygen): browse, buy, my tickets, QR, transfer, orders.
 * Engine: appengine/src/events/events-client.controller.ts (`client/events/*`).
 * Every call carries the app token + the customer JWT (apiReq). Browsing, purchase,
 * payment and the booking lookup are public; tickets/* need the holder signed in.
 */
import { apiReq, type Envelope, type Paged } from "@/lib/api";

const P = "client/events";
const enc = encodeURIComponent;

export type EventRecord = Envelope<Record<string, any>>;
export type TicketTypeRecord = Envelope<Record<string, any>>;
export type TicketRecord = Envelope<Record<string, any>>;
export type BookingRecord = Envelope<Record<string, any>>;
export interface BookingWithTickets { booking: BookingRecord; tickets: TicketRecord[] }
export interface PurchaseInput { eventId: string; email: string; name?: string; items: { ticketTypeId: string; quantity: number }[]; paymentMethod?: string }
export interface StripeIntent { id: string; client_secret: string; publishableKey?: string; amount: number; currency: string; bookingId?: string }

/** GET client/events — published events (the engine pages at 50). */
export const listEvents = (q?: { type?: string; fromDate?: string; toDate?: string; limit?: number }) =>
  apiReq<Paged<EventRecord>>("GET", P, { query: q });

/** GET client/events/:id — by sk or slug; enriched with ticketTypes, sessions, participants. */
export const getEvent = (id: string) =>
  apiReq<{ event: EventRecord; ticketTypes: TicketTypeRecord[] }>("GET", `${P}/${enc(id)}`);

/** POST client/events/tickets/purchase — priced by the engine. Free → paid + tickets; paid → pending booking. */
export const purchaseTickets = (body: PurchaseInput) =>
  apiReq<BookingWithTickets>("POST", `${P}/tickets/purchase`, { data: body });

/** POST client/events/stripe/intent — the card payment for a pending booking, priced from the booking. */
export const createStripeIntent = (bookingId: string) =>
  apiReq<StripeIntent>("POST", `${P}/stripe/intent`, { data: { bookingId } });

/** POST client/events/tickets/confirm-order — issues the tickets once the intent has paid this booking. */
export const confirmOrder = (body: { bookingId: string; paymentRef: string; paymentGateway?: string }) =>
  apiReq<BookingWithTickets>("POST", `${P}/tickets/confirm-order`, { data: body });

/** GET client/events/tickets/mine — tickets held by the signed-in customer's email. */
export const myTickets = (eventId?: string) =>
  apiReq<Paged<TicketRecord>>("GET", `${P}/tickets/mine`, { query: { eventId } });

/** GET client/events/booking?email&bookingId — a booking + its tickets, for the buyer's email only. */
export const getBooking = (email: string, bookingId: string) =>
  apiReq<BookingWithTickets>("GET", `${P}/booking`, { query: { email, bookingId } });

/** GET client/events/tickets/:id/qr — rotates the signed QR (valid 60 s); holder only. */
export const ticketQr = (ticketId: string) => apiReq<TicketRecord>("GET", `${P}/tickets/${enc(ticketId)}/qr`);

/** GET client/events/tickets/:id/perks — holder only. */
export const ticketPerks = (ticketId: string) => apiReq<any>("GET", `${P}/tickets/${enc(ticketId)}/perks`);

/** POST client/events/tickets/:id/transfer — holder only; re-issues the ticket to the new email. */
export const transferTicket = (ticketId: string, body: { email: string; name?: string }) =>
  apiReq<TicketRecord>("POST", `${P}/tickets/${enc(ticketId)}/transfer`, { data: body });
