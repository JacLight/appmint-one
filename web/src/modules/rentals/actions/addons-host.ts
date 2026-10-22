"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type StowboAddOn } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

export type AddonResult = { ok: true } | { ok: false; error: string };

/** Create an add-on the host offers. `price: 0` = a free add-on. */
export async function createAddonAction(input: {
  label: string; description?: string; price?: number; chargeEvery?: string; service?: boolean;
}): Promise<AddonResult> {
  try {
    if (!input.label?.trim()) return { ok: false, error: "Give the add-on a name." };
    await stowbo.host.createAddon({ ...input, label: input.label.trim(), price: Number(input.price ?? 0) });
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not create that add-on.") };
  }
}

export async function updateAddonAction(addonId: string, data: Partial<StowboAddOn>): Promise<AddonResult> {
  try {
    await stowbo.host.updateAddon(addonId, data);
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not update that add-on.") };
  }
}

export async function deleteAddonAction(addonId: string): Promise<AddonResult> {
  try {
    await stowbo.host.deleteAddon(addonId);
    revalidatePath("/host/listings", "layout");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not remove that add-on.") };
  }
}

/** Which of my add-ons apply to this listing. */
export async function setListingAddonsAction(listingId: string, addOns: string[]): Promise<AddonResult> {
  try {
    await stowbo.host.setListingAddons(listingId, addOns);
    revalidatePath(`/host/listings/${listingId}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not save the add-ons for this space.") };
  }
}
