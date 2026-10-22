"use server";

import { getErrorMessage } from "@/lib/errors";
import { getSetup } from "@/lib/setup";
import { storeView } from "../lib/config";
import { cartIdOf, ensureCart, forgetCart, currentCart, rememberCart, type CartKind } from "../lib/cart-cookie";
import { getProduct, getRestaurant, newCart, priceSelection, writeCart } from "@/api/store";
import { selectionProblem, toLineOptions, productImage, type Selection } from "../lib/options";
import type { Cart, CartLine, LineOption } from "../lib/types";

export type CartResult = { ok: true; cart: Cart } | { ok: false; error: string };
export type AddResult = CartResult | { ok: false; conflict: { current: string; next: string } };

const sameOptions = (a?: LineOption[], b?: LineOption[]) =>
  JSON.stringify((a || []).map((o) => [o.name, o.value]).sort()) === JSON.stringify((b || []).map((o) => [o.name, o.value]).sort());

/** The engine's price for a selection — the number on the PDP and the item sheet's
 *  button. The browser never adds option prices up itself. */
export async function priceAction(sku: string, quantity: number, selection: Selection):
  Promise<{ ok: true; unit: number; total: number; currency: string } | { ok: false; error: string }> {
  try {
    const p = await getProduct(sku);
    if (!p) return { ok: false, error: "This item isn’t available any more." };
    const q = Math.max(1, Math.min(99, Math.floor(quantity) || 1));
    const r = await priceSelection(await cartIdOf("bag"), p.data.sku, q, toLineOptions(p, selection));
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t price that right now.") };
  }
}

/** The visitor's cart (bag or food basket) with server totals; null when empty. */
export async function getCartAction(kind: CartKind): Promise<Cart | null> {
  try { return await currentCart(kind); } catch { return null; }
}

/** Header count. */
export async function cartCountAction(kind: CartKind): Promise<number> {
  const c = await currentCart(kind).catch(() => null);
  return c?.totals.count ?? 0;
}

/**
 * Add a product with its options. Lines are re-checked against the product here (it
 * must be listed in this setup's catalog, required options picked); the engine prices
 * the cart. A food basket holds one restaurant: adding from another one returns a
 * `conflict` until the customer says to start a new basket (`fresh`).
 */
export async function addToCartAction(kind: CartKind, input: { sku: string; quantity: number; selection: Selection; extra?: LineOption[] }, fresh = false): Promise<AddResult> {
  try {
    const setup = await getSetup();
    const view = storeView(setup);
    const p = await getProduct(input.sku);
    if (!p) return { ok: false, error: "This item isn’t available any more." };
    const tags = p.post?.tags || [];
    const scope = kind === "food" ? [view.foodTag] : view.tags;
    if (!tags.some((t) => scope.includes(t)) || (kind === "food" ? !view.food : !view.retail)) return { ok: false, error: "This item isn’t sold here." };
    const problem = selectionProblem(p, input.selection);
    if (problem) return { ok: false, error: problem };
    const qty = Math.max(1, Math.min(99, Math.floor(input.quantity) || 1));
    const options = [...toLineOptions(p, input.selection), ...(input.extra || [])];

    let cart = await ensureCart(kind);
    let lines: CartLine[] = cart.lines.map((l) => ({ ...l }));
    let restaurant = cart.restaurant;
    if (kind === "food") {
      const r = p.data.brand ? await getRestaurant(view.foodTag, p.data.brand) : null;
      if (!r) return { ok: false, error: "This item isn’t available any more." };
      if (lines.length && restaurant && restaurant !== r.name) {
        if (!fresh) {
          const cur = await getRestaurant(view.foodTag, restaurant);
          return { ok: false, conflict: { current: cur?.title || "another restaurant", next: r.title } };
        }
        lines = [];
      }
      restaurant = r.name;
    }
    const at = lines.findIndex((l) => l.sku === p.data.sku && sameOptions(l.options, options));
    if (at >= 0) lines[at].quantity = Math.min(99, lines[at].quantity + qty);
    else lines.push({ sku: p.data.sku, quantity: qty, name: p.data.name, image: productImage(p), options });
    cart = await safeWrite(kind, cart.id, lines, kind === "food" ? { restaurant } : {});
    return { ok: true, cart };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t add that. Please try again.") };
  }
}

/** Set a line's quantity (0 removes it). */
export async function setQtyAction(kind: CartKind, index: number, quantity: number): Promise<CartResult> {
  try {
    const cart = await currentCart(kind);
    if (!cart || !cart.lines[index]) return { ok: false, error: "That item isn’t in your cart any more." };
    const q = Math.max(0, Math.min(99, Math.floor(quantity) || 0));
    const lines = cart.lines.map((l) => ({ ...l }));
    if (q === 0) lines.splice(index, 1); else lines[index].quantity = q;
    return { ok: true, cart: await safeWrite(kind, cart.id, lines, kind === "food" ? { restaurant: lines.length ? cart.restaurant : null } : {}) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e, "We couldn’t update your cart.") };
  }
}

/** Write the lines; a cart that is no longer this visitor's (signed out since) is
 *  replaced with a fresh one carrying the same lines. */
async function safeWrite(kind: CartKind, id: string, lines: CartLine[], extra: { restaurant?: string | null }): Promise<Cart> {
  try {
    return await writeCart(id, lines, extra);
  } catch (e: any) {
    const st = e?.response?.status ?? e?.status;
    if (st !== 401 && st !== 404) throw e;
    await forgetCart(kind);
    const fresh = await newCart();
    await rememberCart(kind, fresh.id);
    return writeCart(fresh.id, lines, extra);
  }
}
