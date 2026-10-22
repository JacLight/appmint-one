"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type PickupDelegation } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

type R<T = undefined> = ({ ok: true } & (T extends undefined ? object : { data: T })) | { ok: false; error: string };

/** Hand the pickup of some items to someone else. The server issues the code and the
 *  pass link, texts/emails it to them, and returns the link so the owner can share it too. */
export async function createDelegationAction(bookingId: string, input: { items: string[]; name?: string; phone?: string; email?: string; verify?: "qr" | "qr_name" | "qr_id"; validUntil?: string; note?: string }): Promise<R<PickupDelegation>> {
  try {
    if (!input.items?.length) return { ok: false, error: "Pick what they’re collecting." };
    if (!input.phone?.trim() && !input.email?.trim()) return { ok: false, error: "A phone number or email for them is needed — that’s where the pass goes." };
    const data = await stowbo.createDelegation(bookingId, { ...input, name: input.name?.trim() || undefined, phone: input.phone?.trim() || undefined, email: input.email?.trim() || undefined });
    revalidatePath(`/account/bookings/${bookingId}`);
    return { ok: true, data };
  } catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not set up that pickup.") }; }
}

export async function resendDelegationAction(id: string, bookingId: string): Promise<R<PickupDelegation>> {
  try { const data = await stowbo.resendDelegation(id); revalidatePath(`/account/bookings/${bookingId}`); return { ok: true, data }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not resend the pass.") }; }
}

export async function revokeDelegationAction(id: string, bookingId: string): Promise<R> {
  try { await stowbo.revokeDelegation(id); revalidatePath(`/account/bookings/${bookingId}`); return { ok: true }; }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not cancel that pickup.") }; }
}
