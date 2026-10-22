"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type StowboFee } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

export type FeeResult = { ok: true } | { ok: false; error: string };

/** Create a fee the host charges (booking fee, cleaning, late pick-up…). Defined once,
 *  attached to any listing by name. */
export async function createFeeAction(input: Partial<StowboFee> & { title: string }): Promise<FeeResult> {
  try {
    if (!input.title?.trim()) return { ok: false, error: "Give the fee a name." };
    await stowbo.host.createFee({ ...input, title: input.title.trim() });
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not create that fee.") };
  }
}

export async function updateFeeAction(feeId: string, data: Partial<StowboFee>): Promise<FeeResult> {
  try {
    await stowbo.host.updateFee(feeId, data);
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not update that fee.") };
  }
}

/** Retire a fee (soft delete — bookings that already carry it keep their row). */
export async function deleteFeeAction(feeId: string): Promise<FeeResult> {
  try {
    await stowbo.host.deleteFee(feeId);
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not remove that fee.") };
  }
}

/** Which of my fees apply to this listing (replaces the list). */
export async function setListingFeesAction(listingId: string, fees: string[]): Promise<FeeResult> {
  try {
    await stowbo.host.setListingFees(listingId, fees);
    revalidatePath(`/host/listings/${listingId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not save the fees for this space.") };
  }
}
