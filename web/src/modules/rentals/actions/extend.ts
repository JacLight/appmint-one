"use server";

import { stowbo } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

/** The appengine's global exception filter flattens errors to { statusCode, message } —
 *  the structured `code`/`dueNow` don't survive. So we branch on HTTP STATUS:
 *    402 → payment required for the extra time (server prices + charges it)
 *    409 → the space isn't free for that window
 *  The server owns the amount; the UI only collects a card and shows the server's message. */
function statusOf(e: any): number | undefined {
  return e?.response?.status ?? e?.status ?? e?.response?.data?.statusCode ?? e?.data?.statusCode;
}

export async function extendStayAction(bookingId: string, endDate: string, line?: number, paymentMethodId?: string):
  Promise<
    | { ok: true; endDate: string; total: number }
    | { ok: false; unavailable: true; message: string }
    | { ok: false; needsPayment: true; failed?: boolean; message: string }
    | { ok: false; message: string }
  > {
  try {
    const r = await stowbo.extendBooking(bookingId, { endDate, line, paymentMethodId });
    return { ok: true, endDate: r.endDate, total: r.total };
  } catch (e: any) {
    const status = statusOf(e);
    const message = getErrorMessage(e, "Could not extend this stay.");
    if (status === 409) return { ok: false, unavailable: true, message };
    if (status === 402) {
      // Payment required, or a resubmit whose card was declined — both are 402.
      const failed = /did not go through|didn.t go through|declin|failed/i.test(message);
      return { ok: false, needsPayment: true, failed, message };
    }
    return { ok: false, message };
  }
}
