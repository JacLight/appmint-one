"use server";

import { stowbo } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

/** Buy an upgrade (add-on) on an existing booking. Mirrors the extend flow: the
 *  server charges the card FIRST, then adds the paid line. A 402 means the card was
 *  needed but not supplied, or a supplied card was declined — both come back here so
 *  the UI can collect a card (or say the card was declined) and re-submit. The server
 *  owns the money; the client only passes the amount it quoted from the catalog. */
function statusOf(e: any): number | undefined {
  return e?.response?.status ?? e?.status ?? e?.response?.data?.statusCode ?? e?.data?.statusCode;
}

export async function addBookingAddonAction(
  bookingId: string,
  addon: { name: string; label: string; amount: number; code?: string },
  paymentMethodId?: string,
): Promise<
  | { ok: true }
  | { ok: false; needsPayment: true; failed?: boolean; message: string }
  | { ok: false; message: string }
> {
  try {
    await stowbo.addBookingAddon(bookingId, { ...addon, code: addon.code ?? addon.name, paymentMethodId });
    return { ok: true };
  } catch (e: any) {
    const status = statusOf(e);
    const message = getErrorMessage(e, "Could not add this upgrade.");
    if (status === 402) {
      const failed = /did not go through|didn.t go through|declin|failed/i.test(message);
      return { ok: false, needsPayment: true, failed, message };
    }
    return { ok: false, message };
  }
}
