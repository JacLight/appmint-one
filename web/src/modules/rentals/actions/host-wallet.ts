"use server";

import { revalidatePath } from "next/cache";
import { stowbo } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

/** Request a payout through the HOST route — the server enforces the payout minimum
 *  (platform floor or the host's own higher one) and that money is available. */
export async function requestHostPayoutAction(amount?: number, notes?: string, methodId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (amount != null && !(amount > 0)) return { ok: false, error: "Nothing to cash out." };
    // methodId picks a saved destination; without it the server uses the default one.
    await stowbo.host.requestPayout({ ...(amount != null ? { amount } : {}), ...(notes ? { notes } : {}), ...(methodId ? { methodId } : {}) });
    revalidatePath("/host/earnings"); revalidatePath("/host");
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.response?.data?.message ?? e?.message ?? "");
    if (/no.*method|method.*required/i.test(msg)) return { ok: false, error: "Add a payout method first (bank, PayPal, etc.) — then cash out." };
    return { ok: false, error: getErrorMessage(e, "Could not request the payout.") };
  }
}
