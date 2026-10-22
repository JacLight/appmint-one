"use server";

import { stowbo, type PaymentView } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

/** Look up what a payment link is for. `ref` is a booking id OR a `stowbo-pr-…`
 *  payment-request ref — the server tells them apart. Server-derived: the link's
 *  amount is ignored. */
export async function paymentViewAction(ref: string):
  Promise<{ ok: true; view: PaymentView } | { ok: false; error: string }> {
  try {
    return { ok: true, view: await stowbo.paymentView(ref) };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "We couldn't find that payment.") };
  }
}

/** Pay what is owed — a booking balance or an ad-hoc payment request. The SERVER
 *  decides the amount; we only hand over a card. */
export async function payBookingAction(ref: string, paymentMethodId?: string):
  Promise<
    | { ok: true; paid: number; balance: number; currency: string }
    | { ok: false; needsPayment: true; failed?: boolean; message: string }
    | { ok: false; message: string }
  > {
  try {
    const r = await stowbo.payBooking(ref, { paymentMethodId });
    return { ok: true, paid: r.paid ?? 0, balance: r.balance ?? 0, currency: r.currency };
  } catch (e: any) {
    const status = e?.response?.status ?? e?.status ?? e?.response?.data?.statusCode;
    const message = getErrorMessage(e, "That payment could not be completed.");
    if (status === 402) {
      const failed = /did not go through|didn.t go through|declin|failed/i.test(message);
      return { ok: false, needsPayment: true, failed, message };
    }
    return { ok: false, message };
  }
}
