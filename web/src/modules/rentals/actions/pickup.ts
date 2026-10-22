"use server";

import { stowbo, type PickupPass, type PickupReceipt } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

/** Open a pickup pass by its token. The server decides its state. */
export async function pickupPassAction(token: string):
  Promise<{ ok: true; pass: PickupPass; receipt: PickupReceipt | null } | { ok: false; error: string }> {
  try {
    const pass = await stowbo.pickupPass(token);
    const receipt = pass.state === "completed" ? await stowbo.pickupReceipt(token).catch(() => null) : null;
    return { ok: true, pass, receipt };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "We couldn't open that pass.") };
  }
}
