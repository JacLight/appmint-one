"use server";

import { revalidatePath } from "next/cache";
import { finance } from "@/lib/finance";
import { getErrorMessage } from "@/lib/errors";

/** Request a payout of the given amount to the host's default method. The server
 *  enforces limits (minimum payout, daily cap) and that a method exists. */
export async function requestPayoutAction(amount: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!(amount > 0)) return { ok: false, error: "Nothing to cash out." };
    await finance.requestPayout({ amount });
    revalidatePath("/host/earnings");
    revalidatePath("/account/wallet");
    return { ok: true };
  } catch (e: any) {
    const code = e?.response?.data?.code ?? e?.data?.code;
    if (/no.*method|method.*required/i.test(String(e?.response?.data?.message ?? e?.message ?? "")) || code === "NO_PAYOUT_METHOD") {
      return { ok: false, error: "Add a payout method first (bank, PayPal, etc.) — then cash out." };
    }
    return { ok: false, error: getErrorMessage(e, "Could not request the payout.") };
  }
}
