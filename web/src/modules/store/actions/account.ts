"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errors";
import { ORDERS, REASONS, type ReasonCategory } from "../lib/config";
import { myOrder, requestReturn } from "@/api/store";


/** Start a return for lines of one of my orders. Prices and the refund come from the
 *  order on the engine; the request only names SKUs, quantities and why. */
export async function startReturnAction(orderNumber: string, picks: { sku: string; quantity: number }[], reasonCategory: ReasonCategory, note: string, condition: "unopened" | "opened" | "damaged" | "defective" | "wrong_item"):
  Promise<{ ok: true; rma: string } | { ok: false; error: string }> {
  try {
    const session = await getSession();
    if (!session.signedIn) return { ok: false, error: "Sign in to start a return." };
    if (!REASONS.includes(reasonCategory)) return { ok: false, error: "Pick a reason." };
    const order = await myOrder(orderNumber);
    if (!order) return { ok: false, error: "We couldn’t find that order." };
    const items = picks
      .map((p) => { const l = order.lines.find((x) => x.sku === p.sku); return l ? { l, q: Math.max(0, Math.min(l.quantity, Math.floor(p.quantity) || 0)) } : null; })
      .filter((x): x is { l: (typeof order.lines)[number]; q: number } => !!x && x.q > 0)
      .map(({ l, q }) => ({ sku: String(l.sku), name: String(l.name || l.sku), quantity: l.quantity, returnQuantity: q, price: Number(l.price || 0), reason: note.trim() || reasonCategory.replace(/_/g, " "), condition }));
    if (!items.length) return { ok: false, error: "Pick at least one item to return." };
    const r = await requestReturn({ orderNumber, reason: note.trim() || reasonCategory.replace(/_/g, " "), reasonCategory, type: "return", items, refundMethod: "original_payment" });
    revalidatePath(`${ORDERS}/${orderNumber}`);
    revalidatePath("/account/returns");
    return { ok: true, rma: r.rmaNumber };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t start that return.") };
  }
}
