/**
 * base-app's `eventsAPI` surface (base-app/src/lib/events-api.ts) for the ported
 * screens, backed by server actions → src/api/events.ts. Methods base-app lets throw
 * still throw, with the engine's message.
 */
import * as a from "../actions/events";

const orThrow = async <T,>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> => {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

export const eventsAPI = {
  getEvents: a.getEvents,
  getEventDetail: a.getEventDetail,
  getMyEventTickets: a.getMyEventTickets,
  getEventBooking: a.getEventBooking,
  getEventTicketQR: a.getEventTicketQR,
  getEventTicketPerks: a.getEventTicketPerks,
  purchaseEventTickets: (body: Parameters<typeof a.purchaseEventTickets>[0]) => orThrow(a.purchaseEventTickets(body)),
  createEventStripeIntent: (body: { bookingId: string }) => orThrow(a.createEventStripeIntent(body)),
  confirmEventOrder: (body: Parameters<typeof a.confirmEventOrder>[0]) => orThrow(a.confirmEventOrder(body)),
  transferEventTicket: (ticketId: string, body: { email: string; name?: string }) => orThrow(a.transferEventTicket(ticketId, body)),
};
