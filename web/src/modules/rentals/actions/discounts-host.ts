"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type HostDiscount } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

export type DiscountResult = { ok: true } | { ok: false; error: string };

/** Create a coupon. The server uppercases the code, refuses one already in use anywhere in
 *  the org, and scopes it to the host's listings (`listings` = names; empty = all of mine). */
export async function createDiscountAction(input: Partial<HostDiscount> & { code: string }): Promise<DiscountResult> {
  try {
    if (!input.code?.trim()) return { ok: false, error: "Give the coupon a code." };
    await stowbo.host.createDiscount({ ...input, code: input.code.trim().toUpperCase() });
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not create that coupon.") };
  }
}

export async function updateDiscountAction(id: string, data: Partial<HostDiscount>): Promise<DiscountResult> {
  try {
    await stowbo.host.updateDiscount(id, data);
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not update that coupon.") };
  }
}

/** Retire a coupon: the code stops working; bookings that used it keep their discount. */
export async function deleteDiscountAction(id: string): Promise<DiscountResult> {
  try {
    await stowbo.host.deleteDiscount(id);
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not retire that coupon.") };
  }
}
