"use server";
/**
 * Server actions behind the ported base-app events screens (base/*). Each one is
 * base-app's `eventsAPI` method (base-app/src/lib/events-api.ts) with its engine call
 * routed through src/api/events.ts. Same return shapes and the same "quiet" fallbacks
 * ([] / null) as base-app; the calls base-app lets throw come back as `{ error }` and
 * are re-thrown in the browser by base/events-client.ts (server-action errors lose
 * their message in production).
 */
import * as api from "@/api/events";
import { getErrorMessage } from "@/lib/errors";

type Res<T> = { ok: true; data: T } | { ok: false; error: string };
const unwrap = (r: any) => r?.data || r;

export async function getEvents(params?: { type?: string; fromDate?: string; toDate?: string; limit?: number }): Promise<any> {
  try {
    // A ticket shop lists what's still ahead, soonest first (the engine sorts newest first).
    const fromDate = params?.fromDate ?? new Date().toISOString().slice(0, 10);
    const res = unwrap(await api.listEvents({ ...params, fromDate }));
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : null;
    if (!list) return res;
    const at = (e: any) => Date.parse(e?.data?.startDate ?? e?.startDate ?? "") || 0;
    const sorted = [...list].sort((a, b) => at(a) - at(b));
    return Array.isArray(res) ? sorted : { ...res, data: sorted };
  } catch (error) {
    console.error("Error fetching events:", getErrorMessage(error, ""));
    return [];
  }
}

export async function getEventDetail(eventId: string): Promise<{ event: any; ticketTypes: any[] } | null> {
  try {
    const data: any = unwrap(await api.getEvent(eventId));
    if (data?.event) return { ...data, event: withVenue(data.event) };
    return { event: data, ticketTypes: data?.ticketTypes || [] };
  } catch (error) {
    console.error("Error fetching event detail:", getErrorMessage(error, ""));
    return null;
  }
}

export async function purchaseEventTickets(body: api.PurchaseInput): Promise<Res<api.BookingWithTickets>> {
  try {
    return { ok: true, data: unwrap(await api.purchaseTickets(body)) };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Purchase failed. Please try again.") };
  }
}

export async function createEventStripeIntent(body: { bookingId: string }): Promise<Res<api.StripeIntent>> {
  try {
    return { ok: true, data: unwrap(await api.createStripeIntent(body.bookingId)) };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Payment initialization failed") };
  }
}

export async function confirmEventOrder(body: { bookingId: string; paymentRef: string; paymentGateway: string }): Promise<Res<api.BookingWithTickets>> {
  try {
    return { ok: true, data: (await named(unwrap(await api.confirmOrder(body))))! };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Failed to confirm booking.") };
  }
}

/** base-app reads `venue` as `{ name, address, city }`; this engine stores the venue name
 *  as a string with the address beside it. */
function withVenue(ev: any) {
  const d = ev?.data;
  if (!d || typeof d.venue !== "string") return ev;
  const a = d.address && typeof d.address === "object" ? d.address : { address: d.address };
  return { ...ev, data: { ...d, venue: { name: d.venue, address: a.street || a.line1 || a.address, city: a.city, state: a.state, country: a.country } } };
}

/**
 * base-app reads `eventName`, `eventDate`, `ticketTypeName` and `ticketTypeColor` off
 * tickets and bookings; this engine stores only the event / ticket-type ids, so they are
 * filled in here from each event's own record (one lookup per event).
 */
async function withNames<T extends { data?: any }>(rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.map((t) => String(t?.data?.event || t?.data?.eventId || "")).filter(Boolean))];
  const events = new Map<string, any>();
  await Promise.all(ids.map(async (id) => { events.set(id, await getEventDetail(id)); }));
  return rows.map((t) => {
    const d = events.get(String(t?.data?.event || t?.data?.eventId || ""));
    const ev = d?.event?.data || {};
    const tt = (d?.ticketTypes || []).find((x: any) => String(x.sk || x._id) === String(t?.data?.ticketType))?.data || {};
    return { ...t, data: { eventName: ev.title || ev.name, eventDate: ev.startDate, ticketTypeName: tt.title || tt.name, ticketTypeColor: tt.color, ...t.data } };
  });
}

const named = async (r: api.BookingWithTickets | null) => {
  if (!r?.booking) return r;
  const [b] = await withNames([r.booking]);
  const booking = { ...b, data: { buyerName: b.data?.holderName, buyerEmail: b.data?.email, ...b.data } };
  return { booking, tickets: await withNames(r.tickets || []) };
};

export async function getMyEventTickets(eventId?: string): Promise<any[]> {
  try {
    return await withNames(unwrap(await api.myTickets(eventId)) || []);
  } catch (error) {
    console.error("Error fetching my tickets:", getErrorMessage(error, ""));
    return [];
  }
}

export async function getEventBooking(email: string, bookingId: string): Promise<api.BookingWithTickets | null> {
  try {
    return await named(unwrap(await api.getBooking(email, bookingId)));
  } catch (error) {
    console.error("Error fetching booking:", getErrorMessage(error, ""));
    return null;
  }
}

export async function getEventTicketQR(ticketId: string): Promise<any> {
  try {
    return unwrap(await api.ticketQr(ticketId));
  } catch (error) {
    console.error("Error fetching ticket QR:", getErrorMessage(error, ""));
    return null;
  }
}

export async function transferEventTicket(ticketId: string, body: { email: string; name?: string }): Promise<Res<any>> {
  try {
    return { ok: true, data: unwrap(await api.transferTicket(ticketId, body)) };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error, "Transfer failed") };
  }
}

export async function getEventTicketPerks(ticketId: string): Promise<any> {
  try {
    return unwrap(await api.ticketPerks(ticketId));
  } catch (error) {
    console.error("Error fetching ticket perks:", getErrorMessage(error, ""));
    return null;
  }
}
