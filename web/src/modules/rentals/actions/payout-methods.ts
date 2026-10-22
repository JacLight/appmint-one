"use server";

import { revalidatePath } from "next/cache";
import { stowbo, type HostPayoutMethod } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

type R = { ok: true } | { ok: false; error: string };
const done = (): R => { revalidatePath("/host/earnings"); return { ok: true }; };

/** Save a destination for payouts: a bank account (ACH) or a PayPal email. The
 *  server seals the bank numbers and keeps only the last four for display. */
export async function addPayoutMethodAction(input: HostPayoutMethod): Promise<R> {
  try {
    if (input.type === "bank") {
      const b = input.bank || {};
      if (!b.accountHolderName?.trim()) return { ok: false, error: "Whose name is on the account?" };
      if (!/^\d{9}$/.test(String(b.routingNumber || "").trim())) return { ok: false, error: "Routing number is 9 digits." };
      if (!/^\d{4,17}$/.test(String(b.accountNumber || "").trim())) return { ok: false, error: "Check the account number." };
    } else if (input.type === "paypal") {
      if (!/^\S+@\S+\.\S+$/.test(String(input.paypal?.email || "").trim())) return { ok: false, error: "Enter the email on the PayPal account." };
    } else return { ok: false, error: "Choose bank or PayPal." };
    await stowbo.host.addPayoutMethod(input);
    return done();
  } catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not save that destination.") }; }
}

export async function removePayoutMethodAction(id: string): Promise<R> {
  try { await stowbo.host.removePayoutMethod(id); return done(); }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not remove it.") }; }
}

export async function setDefaultPayoutMethodAction(id: string): Promise<R> {
  try { await stowbo.host.setDefaultPayoutMethod(id); return done(); }
  catch (e: any) { return { ok: false, error: getErrorMessage(e, "Could not change the default.") }; }
}
