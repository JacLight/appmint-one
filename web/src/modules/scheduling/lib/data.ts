/**
 * Scheduling's view of the engine data: reads through @/api/reservations (the only place
 * the engine routes live) and maps the records to what the screens show, scoped to this
 * setup's booking types and plans.
 */
import "server-only";
import { cache } from "react";
import * as R from "@/api/reservations";
import { getSetup } from "@/lib/setup";
import type { Setup } from "@/setups/types";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { toBooking, toBookingDetail, toBookingType, toInvoice, toMembership, toPlan } from "./catalog";
import type { Availability, Booking, BookingDetail, BookingType, FormAnswer, Invoice, Membership, Plan } from "./types";

export const statusOf = (e: any): number => Number(e?.response?.status || e?.status || e?.statusCode || 0);

export function configOf(setup: Setup): SchedulingConfig | null {
  return setup.scheduling || null;
}

export async function getConfig(): Promise<SchedulingConfig | null> {
  return configOf(await getSetup());
}


// ───────── public: booking types, times, plans ─────────

/** This business's booking types: GET crm/reservations/definitions (public), active.
 *  When the org holds several businesses' types, the setup's prefix (and `include`) picks
 *  this one's; when none carry it, every active type the org has is this business's.
 *  One call per request. */
export const bookingTypes = cache(async (): Promise<BookingType[]> => (await loadBookingTypes()).types);

/** The same, saying whether the engine answered, so a page can tell "nothing to book" from
 *  "couldn't ask". */
export const loadBookingTypes = cache(async (): Promise<{ types: BookingType[]; ok: boolean }> => {
  const cfg = await getConfig();
  if (!cfg) return { types: [], ok: true };
  let ok = true;
  const r = await R.listDefinitions().catch(() => ((ok = false), []));
  const mine = r.map((d) => toBookingType(d, cfg.prefix, cfg.include)).filter(Boolean) as BookingType[];
  return { ok, types: mine.length ? mine : (r.map((d) => toBookingType(d, "")).filter(Boolean) as BookingType[]) };
});

export async function bookingType(slug: string): Promise<BookingType | null> {
  const all = await bookingTypes();
  return all.find((t) => t.slug === slug || t.name === slug || t.id === slug) || null;
}

/** The service name the engine is asked about: the one chosen, else the type's first; none for a
 *  type booked as itself. */
export function serviceName(type: BookingType, wanted?: string): string | undefined {
  const s = type.services.find((x) => x.name === wanted) || type.services[0];
  return s && !s.implicit ? s.name : undefined;
}

/** Open times for a booking type, `days` days from `from` (YYYY-MM-DD, business zone):
 *  POST crm/reservations/availability (public). `exclude` is the booking being moved. */
export async function availability(type: BookingType, opts: { from?: string; days?: number; host?: string; service?: string; exclude?: string } = {}): Promise<Availability | null> {
  try {
    const r: any = await R.getAvailability({
      reservationDefinitionId: type.id, serviceName: serviceName(type, opts.service), from: opts.from,
      days: Math.min(31, Math.max(1, opts.days || 7)), host: opts.host, excludeReservationId: opts.exclude,
    });
    if (!r || !Array.isArray(r.days)) return null;
    return { service: r.service, timezone: r.timezone || type.timezone, nextAvailable: r.nextAvailable || null, days: r.days };
  } catch {
    return null;
  }
}

/** Packs and memberships: GET storefront/subscriptions/plans (public). */
export const plans = cache(async (): Promise<Plan[]> => {
  const cfg = await getConfig();
  if (!cfg?.planPrefix && !cfg?.includePlans?.length) return [];
  const r = await R.listPlans().catch(() => []);
  return r
    .filter((p) => (cfg.planPrefix && String(p?.name || "").startsWith(cfg.planPrefix)) || cfg.includePlans?.includes(String(p?.name || "")))
    .map((p) => toPlan(p, ""))
    .filter(Boolean) as Plan[];
});

// ───────── the signed-in customer ─────────

/** My reservations of this business's types as the engine sends them (sk + data), for the
 *  ported base-app account view; the type's zone and title fill what the record leaves out. */
export async function myReservationRecords(): Promise<any[]> {
  const [types, r] = await Promise.all([bookingTypes(), R.myReservations().catch(() => [])]);
  const byId = new Map(types.map((t) => [t.id, t]));
  return r
    .filter((x) => byId.has(x?.data?.reservationDefinitionId))
    .map((x) => {
      const t = byId.get(x.data.reservationDefinitionId)!;
      return { ...x, data: { ...x.data, timezone: x.data.timezone || t.timezone, serviceName: x.data.serviceName || t.title } };
    })
    .sort((a, b) => String(b.data.startTime).localeCompare(String(a.data.startTime)));
}

/** One of my bookings, as the record holds it: GET client-data/reservations/:id (the
 *  engine answers 404 for anyone else's). */
export async function myBooking(id: string): Promise<BookingDetail | null> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  return toBookingDetail(await R.myReservation(id).catch(() => null));
}

/** A guest's booking, found by the email on it and its number (the guest's proof):
 *  GET crm/reservations/by-email/:email/:number (public). */
export async function guestBooking(email: string, number: string): Promise<BookingDetail | null> {
  if (!email || !/^[A-Za-z0-9]{4,20}$/.test(number)) return null;
  const r = await R.findByEmail(email, number).catch(() => []);
  const hit = r.find((x: any) => String(x?.data?.name || x?.name || "").toUpperCase() === number.toUpperCase());
  return hit ? toBookingDetail(hit) : null;
}

/** My memberships and packs of this business's plans: GET storefront/subscriptions/get/me. */
export async function myMemberships(): Promise<Membership[]> {
  const list = await plans();
  if (!list.length) return [];
  const r = await R.mySubscriptions().catch(() => []);
  return r.map((s) => toMembership(s, list)).filter(Boolean) as Membership[];
}

/** Invoices billed to me, with the engine's balance: GET client-data/all → invoices. */
export async function myInvoices(): Promise<Invoice[]> {
  const r: any = await R.myAccountData().catch(() => null);
  return (Array.isArray(r?.invoices) ? r.invoices : []).map(toInvoice).filter(Boolean) as Invoice[];
}

/** Forms I've answered (or still owe): GET client-data/forms. */
export async function myForms(): Promise<FormAnswer[]> {
  const r = await R.myFormSubmissions(100).catch(() => []);
  return r.map((f: any) => ({ id: String(f.id), form: f.form?.name, title: f.form?.title, status: String(f.status || ""), submittedAt: f.submittedAt || null }));
}

/** A booking type's form (the definition's `form`): GET client/forms/:name (public). */
export async function bookingForm(name: string): Promise<any | null> {
  const r: any = await R.getForm(name).catch(() => null);
  return r?.form?.data || r?.data?.form?.data || null;
}
