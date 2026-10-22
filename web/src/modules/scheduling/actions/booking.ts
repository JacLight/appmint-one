"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import * as R from "@/api/reservations";
import { bookingTypes, guestBooking, myBooking, plans, statusOf } from "../lib/data";
import { isClosed } from "../lib/catalog";

const MINE = "/account/scheduling";

type Fail = { ok: false; error: string; signIn?: boolean; taken?: boolean };

const clean = (v: any, max = 2000) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const takenMsg = "That time was just taken. Pick another.";
/** The engine says a time can't take the booking with 409 (move) or 400 SLOT_TAKEN (book). */
const isTaken = (e: any) => statusOf(e) === 409 || /SLOT_TAKEN|slot_unavailable/.test(JSON.stringify(e?.response?.data ?? e?.data ?? ""));

const LABELS: Record<string, string> = { area: "Area", opposingParty: "Other parties", insurance: "Insurance" };

/**
 * Book a time. The engine checks the time, capacity and host and saves the reservation
 * with what the customer told us (`notes` and `intake`). Signed in: the account's own
 * booking (POST client-data/reservations). Not signed in: a guest booking with their
 * name and email (POST crm/reservations/book).
 */
export async function bookAction(input: {
  typeId: string; startTime: string; host?: string; service?: string; intake?: Record<string, string>;
  guest?: { name: string; email: string; phone?: string };
}): Promise<{ ok: true; id: string; number: string; guest?: { email: string } } | Fail> {
  const session = await getSession();
  const types = await bookingTypes();
  const type = types.find((t) => t.id === input.typeId);
  if (!type) return { ok: false, error: "That booking type isn’t available any more." };
  if (!input.startTime || Number.isNaN(Date.parse(input.startTime))) return { ok: false, error: "Pick a time first." };
  const host = input.host && type.hosts.includes(input.host.toLowerCase()) ? input.host.toLowerCase() : undefined;
  const intake = Object.fromEntries(Object.entries(input.intake || {}).map(([k, v]) => [k, clean(v)]).filter(([k, v]) => /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k) && v));
  const service = input.service && type.services.some((s) => s.name === input.service) ? input.service : type.services[0]?.name;
  const notes = [intake.reason, ...Object.entries(intake).filter(([k]) => LABELS[k]).map(([k, v]) => `${LABELS[k]}: ${v}`)].filter(Boolean).join("\n") || undefined;
  const body: Record<string, any> = { reservationDefinitionId: type.id, service, startTime: input.startTime, hosts: host, notes, intake: Object.keys(intake).length ? intake : undefined };

  let guestEmail: string | undefined;
  if (session.signedIn && session.customer?.email) {
    const c = session.customer;
    body.customer = { name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email, email: c.email, phone: c.phone || undefined };
  } else {
    const name = clean(input.guest?.name, 120);
    const email = clean(input.guest?.email, 200).toLowerCase();
    const phone = clean(input.guest?.phone, 40);
    if (!name) return { ok: false, error: "Please add your name." };
    if (!EMAIL.test(email)) return { ok: false, error: "Please add an email we can send the confirmation to." };
    body.customer = { name, email, phone: phone || undefined };
    guestEmail = email;
  }
  try {
    const r: any = guestEmail ? await R.bookAsGuest(body as R.BookInput) : await R.bookReservation(body as R.BookInput);
    const rec = r?.sk ? r : r?.data?.sk ? r.data : r;
    revalidatePath(MINE);
    return { ok: true, id: String(rec?.sk || ""), number: String(rec?.data?.name || rec?.name || ""), guest: guestEmail ? { email: guestEmail } : undefined };
  } catch (e) {
    if (isTaken(e)) return { ok: false, taken: true, error: takenMsg };
    return { ok: false, error: getErrorMessage(e, "We couldn’t book that. Please try again.") };
  }
}

/** Cancel: the customer's cancel by the email on the booking and its number. The engine
 *  keeps the booking, marks it cancelled, stops its reminders and sends the notice. */
export async function cancelAction(input: { id?: string; email?: string; number?: string }): Promise<{ ok: true } | Fail> {
  let email = "", number = "", status = "";
  if (input.id) {
    const session = await getSession();
    if (!session.signedIn || !session.customer?.email) return { ok: false, error: "Sign in first.", signIn: true };
    const b = await myBooking(input.id);
    if (!b) return { ok: false, error: "We couldn’t find that booking." };
    email = b.booking.customer.email || session.customer.email;
    number = b.booking.number;
    status = b.booking.status;
  } else {
    const b = await guestBooking(clean(input.email, 200), clean(input.number, 20));
    if (!b) return { ok: false, error: "We couldn’t find that booking." };
    email = clean(input.email, 200);
    number = b.booking.number;
    status = b.booking.status;
  }
  if (isClosed(status)) return { ok: true };
  try {
    await R.cancelByEmail(email, number);
    revalidatePath(MINE);
    if (input.id) revalidatePath(`${MINE}/${input.id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t cancel that. Please try again.") };
  }
}

/** Move a booking. The engine re-checks the new time (open, free, the same person free)
 *  and answers 409 when it can't take it. */
export async function rescheduleAction(input: { id?: string; email?: string; number?: string; startTime: string }): Promise<{ ok: true } | Fail> {
  const { startTime } = input;
  if (!startTime || Number.isNaN(Date.parse(startTime))) return { ok: false, error: "Pick a new time first." };
  try {
    if (input.id) {
      const session = await getSession();
      if (!session.signedIn) return { ok: false, error: "Sign in first.", signIn: true };
      await R.rescheduleReservation(input.id, startTime, "Moved online by the client");
      revalidatePath(MINE); revalidatePath(`${MINE}/${input.id}`);
    } else {
      await R.rescheduleByEmail(clean(input.email, 200), clean(input.number, 20), startTime, "Moved online by the client");
    }
    return { ok: true };
  } catch (e) {
    if (isTaken(e)) return { ok: false, taken: true, error: "That time can’t take the booking any more. Pick another." };
    return { ok: false, error: getErrorMessage(e, "We couldn’t move that booking. Please try again.") };
  }
}

/** Answer the booking type's form (the definition's `form`): POST client/forms/:name/submit. */
export async function submitIntakeAction(bookingId: string, form: string, values: Record<string, any>): Promise<{ ok: true } | Fail> {
  const session = await getSession();
  if (!session.signedIn || !session.customer?.email) return { ok: false, error: "Sign in first.", signIn: true };
  const b = await myBooking(bookingId);
  const type = b ? (await bookingTypes()).find((t) => t.id === b.booking.definitionId) : undefined;
  if (!type || type.form !== form) return { ok: false, error: "That form isn’t part of this booking." };
  const answers: Record<string, any> = {};
  for (const [k, v] of Object.entries(values || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(k)) continue;
    answers[k] = typeof v === "boolean" ? v : clean(v, 4000);
  }
  answers.email = session.customer.email;
  try {
    await R.submitForm(form, answers);
    revalidatePath(`${MINE}/${bookingId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t send the form. Please try again.") };
  }
}

/**
 * Buy a membership or class pack. The engine prices it from the plan and charges the
 * card Stripe tokenised in the browser; a bank challenge comes back as a client secret
 * for the browser to confirm.
 */
export async function buyPlanAction(planName: string, paymentMethodId: string):
  Promise<{ ok: true; status: string; clientSecret?: string } | Fail> {
  const session = await getSession();
  if (!session.signedIn || !session.customer?.email) return { ok: false, error: "Sign in to buy.", signIn: true };
  const plan = (await plans()).find((p) => p.name === planName);
  if (!plan) return { ok: false, error: "That option isn’t on sale any more." };
  if (!/^pm_[A-Za-z0-9_]+$/.test(paymentMethodId)) return { ok: false, error: "Please check your card details." };
  try {
    const r = await R.subscribe({ plan: plan.name, paymentMethodId, autoRenew: plan.kind === "membership" });
    revalidatePath(MINE);
    return { ok: true, status: String(r?.data?.status || ""), clientSecret: r?.payment?.clientSecret || undefined };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "Your card wasn’t charged. Please try again.") };
  }
}

/** Pay an invoice: the engine creates the intent for what it says is owed (client-data/pay/:id/intent). */
export async function invoiceIntentAction(invoiceId: string): Promise<{ ok: true; clientSecret: string; amount: number; currency: string } | { ok: true; settled: true } | Fail> {
  const session = await getSession();
  if (!session.signedIn) return { ok: false, error: "Sign in to pay.", signIn: true };
  try {
    const pi = await R.invoicePaymentIntent(invoiceId);
    if (pi?.alreadySettled) return { ok: true, settled: true };
    if (!pi?.client_secret) return { ok: false, error: "We couldn’t start the payment. Please try again." };
    return { ok: true, clientSecret: pi.client_secret, amount: Number(pi.amount) / 100, currency: String(pi.currency || "usd").toUpperCase() };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t start the payment.") };
  }
}

/** Record what the gateway charged against the invoice (POST client-data/pay/:id). */
export async function invoiceConfirmAction(invoiceId: string, paymentIntentId: string): Promise<{ ok: true } | Fail> {
  const session = await getSession();
  if (!session.signedIn) return { ok: false, error: "Sign in to pay.", signIn: true };
  try {
    await R.recordInvoicePayment(invoiceId, { gateway: "stripe", ref: paymentIntentId, method: "card" });
    revalidatePath(MINE);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "Your payment went through but the invoice isn’t updated yet. Refresh in a moment.") };
  }
}
