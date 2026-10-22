"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type BookingItemInput } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

/** Ask the host to act on my booking — bring things out / put back / check out.
 *  A signal on the shared timeline the host fulfils with their own actions. */
export async function requestBookingAction(bookingId: string, type: "out" | "in" | "checkout", note?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await stowbo.requestBooking(bookingId, { type, note });
    revalidatePath(`/account/bookings/${bookingId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not send your request.") };
  }
}

/** Cancel my own booking — the server frees the unit, voids the hold and records
 *  any refund per the listing's cancellation policy. */
export async function cancelMyBookingAction(bookingId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await stowbo.cancelBooking(bookingId);
    revalidatePath("/account/bookings");
    revalidatePath(`/account/bookings/${bookingId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not cancel this booking.") };
  }
}

export type BookingResult =
  | { ok: true; reference: string; total?: number; currency?: string }
  | { ok: false; error: string };

/** Place a booking with one or more unit lines (each its own dates + add-ons). */
export async function createBookingAction(items: BookingItemInput[], currency = "USD"): Promise<BookingResult> {
  try {
    if (!items.length) return { ok: false, error: "Add at least one unit and its dates." };
    const res: any = await stowbo.createBooking({ items, currency });
    const d = res?.data ?? res;
    return {
      ok: true,
      reference: d?.reference || d?.name || res?.sk || "booked",
      total: d?.total ?? d?.subtotal,
      currency: d?.currency || currency,
    };
  } catch (e: any) {
    return { ok: false, error: cleanBookingError(getErrorMessage(e, "Could not place the booking. Please try again.")) };
  }
}

/** The availability error names the listing by its raw id — hide that from users. */
function cleanBookingError(msg: string): string {
  const m = msg.match(/^\S+ is not available for that window\s*[—-]?\s*(.*)$/i);
  if (m) return `Not available for those dates${m[1] ? ` — ${m[1]}` : ""}. Try different dates or fewer units.`;
  if (/not available/i.test(msg)) return "This space isn't available for those dates. Try different dates or fewer units.";
  return msg;
}

/** Ask the server what cancelling this booking means in money — refund, fee, due —
 *  BEFORE the guest confirms. The cancel then writes these same numbers. */
export async function cancelPreviewAction(bookingId: string): Promise<{ ok: true; due: import("@/api/rentals").BookingDue } | { ok: false; error: string }> {
  try { return { ok: true, due: await stowbo.bookingDue(bookingId, "cancel") }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not work out the refund.") }; }
}
