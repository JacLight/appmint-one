"use server";

import { stowbo, type BookingItemInput, type CheckoutCart, type CheckoutQuote, type CheckoutResume } from "@/api/rentals";
import { getErrorMessage } from "@/lib/errors";

function is404(e: any): boolean {
  return e?.response?.status === 404 || e?.status === 404 || /404|not found/i.test(String(e?.message || ""));
}
/** Pull the server's machine code (UNAVAILABLE / HOLD_EXPIRED / HOLD_IN_PROGRESS / PAYMENT_FAILED). */
function errCode(e: any): string | undefined {
  const d = e?.response?.data ?? e?.data;
  return d?.code || d?.error?.code || (typeof d?.error === "object" ? d.error.code : undefined);
}
const CUR = "USD";

/** How many units of a listing/spot are free for the chosen window (server-checked).
 *  Dates drive this — you query availability FOR the dates, then bound quantity by it. */
export async function availabilityAction(listingId: string, startDate: string, endDate: string):
  Promise<{ ok: true; available: number; capacity: number; sufficient: boolean; fitReason?: string } | { ok: false }> {
  try {
    const a: any = await stowbo.availability(listingId, { startDate, endDate });
    return { ok: true, available: Number(a?.available ?? 0), capacity: Number(a?.capacity ?? 0), sufficient: !!a?.sufficient, fitReason: a?.fitReason };
  } catch {
    return { ok: false };
  }
}

/** Stripe's publishable key (browser-safe) for mounting the card field at checkout. */
export async function stripeKeyAction(): Promise<{ ok: true; publishableKey: string } | { ok: false }> {
  try {
    const gateways = await stowbo.paymentGateways();
    const stripe = (gateways ?? []).map((g: any) => g?.data ?? g).find((d: any) => d?.provider === "stripe" || /stripe/i.test(d?.name ?? ""));
    const key = stripe?.publishableKey;
    return key ? { ok: true, publishableKey: key } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** Ask the server to price the cart — the UI displays this, it never computes totals. */
export async function quoteAction(items: BookingItemInput[], discountCode?: string):
  Promise<{ ok: true; quote: CheckoutQuote } | { ok: false; notFound?: boolean; error?: string }> {
  try {
    if (!items.length) return { ok: false, error: "empty" };
    const quote = await stowbo.quote({ items, currency: CUR, ...(discountCode?.trim() ? { discountCode: discountCode.trim() } : {}) });
    return { ok: true, quote };
  } catch (e: any) {
    if (is404(e)) return { ok: false, notFound: true };
    return { ok: false, error: getErrorMessage(e, "Could not price the cart.") };
  }
}

/** Save the open cart (items + step) so it survives device switches. */
export async function saveCartAction(items: BookingItemInput[], step: string):
  Promise<{ ok: true; cart: CheckoutCart } | { ok: false; notFound?: boolean; code?: string; checkoutId?: string; expiresAt?: string; error?: string }> {
  try {
    const cart = await stowbo.saveCart({ items, currency: CUR, step });
    return { ok: true, cart };
  } catch (e: any) {
    if (is404(e)) return { ok: false, notFound: true };
    const d = e?.response?.data ?? e?.data;
    // A live hold blocks editing the cart — hand back the ids so the UI can offer
    // "continue / start over" instead of a dead-end error.
    return { ok: false, code: errCode(e), checkoutId: d?.checkoutId, expiresAt: d?.expiresAt, error: getErrorMessage(e, "Could not save your cart.") };
  }
}

/** Is there a LIVE hold in progress (capacity claimed, not yet expired)? Drives the
 *  "you have a checkout in progress — continue / start over" banner so a stranded
 *  hold is never a dead end. Returns null when there's nothing live to resume. */
export async function pendingHoldAction():
  Promise<{ checkoutId: string; expiresAt?: string | null } | null> {
  try {
    const r: any = await stowbo.resumeCheckout();
    if (r?.resumable && r.holdExpiresAt && !r.holdExpired && r.checkoutId) {
      return { checkoutId: r.checkoutId, expiresAt: r.holdExpiresAt };
    }
    return null;
  } catch { return null; }
}

/* ── the checkout page's data, loaded from the SERVER cart (source of truth) ── */
export type CheckoutServerLine = { listing: string; title: string; startDate?: string; endDate?: string; quantity?: number; amount?: number };
export type CheckoutServerData = {
  checkoutId: string; holdExpiresAt?: string | null;
  quote?: CheckoutQuote | null; currency?: string;
  dueNow?: number; dueUpfront?: number; dueDeposit?: number;
  returnTo?: string | null;
  lines: CheckoutServerLine[];
};

/** Add lines to the customer's open cart WITHOUT losing what's already there.
 *  The server keeps ONE cart and `saveCart` REPLACES its items, so we read the
 *  current cart first and merge — a second listing adds to the cart, never
 *  wipes the first. Deduped by listing+dates so re-adding is idempotent. */
/** The discount code the open cart carries — resume() doesn't echo it, but the priced
 *  quote does: as an applied discount, or as the rejected code. */
function cartCode(r: any): string | undefined {
  return r?.discountCode || r?.quote?.discounts?.[0]?.code || r?.quote?.discountRejected?.code || undefined;
}

export async function addToCartAction(items: BookingItemInput[], returnTo?: string, discountCode?: string):
  Promise<{ ok: true; count: number } | { ok: false; notFound?: boolean; code?: string; error?: string }> {
  try {
    let existing: BookingItemInput[] = [];
    let liveHoldId: string | null = null;
    let code: string | undefined = discountCode?.trim() || undefined;
    try {
      const r: any = await stowbo.resumeCheckout();
      if (r?.resumable) {
        // resume() exposes the priced lines, not a separate items array.
        existing = (r.quote?.lines ?? []).map((l: any) => ({ listing: l.listing, startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, addOns: l.addOns }));
        if (r.holdExpiresAt && !r.holdExpired && r.checkoutId) liveHoldId = r.checkoutId;
        // A code already on the cart stays unless this add brings its own.
        if (!code) code = cartCode(r);
      }
    } catch { /* no open cart yet */ }
    // A live hold locks the cart from edits (the backend refuses to change lines
    // underneath claimed capacity). Rather than GATE the shopper, release the hold
    // so they keep shopping — the capacity is simply re-held when they hit checkout.
    if (liveHoldId) { try { await stowbo.abandonCheckout(liveHoldId); } catch { /* best effort */ } }
    const key = (l: BookingItemInput) => `${l.listing}|${l.startDate}|${l.endDate}`;
    const seen = new Set(existing.map(key));
    const merged = [...existing, ...items.filter((l) => !seen.has(key(l)))];
    // returnTo = the listing they came from, so checkout can link straight back.
    await stowbo.saveCart({ items: merged, currency: CUR, step: "cart", ...(returnTo ? { returnTo } : {}), ...(code ? { discountCode: code } : {}) });
    return { ok: true, count: merged.length };
  } catch (e: any) {
    if (is404(e)) return { ok: false, notFound: true };
    return { ok: false, code: errCode(e), error: getErrorMessage(e, "Could not add to cart.") };
  }
}

/** Lightweight cart summary for the header cart button — how many lines are in
 *  the open cart (hold or not), so "your purchase in progress" is always reachable. */
export async function cartCountAction(): Promise<{ count: number; held: boolean }> {
  try {
    const r: any = await stowbo.resumeCheckout();
    if (!r?.resumable) return { count: 0, held: false };
    return { count: (r.quote?.lines ?? []).length, held: !!(r.holdExpiresAt && !r.holdExpired) };
  } catch { return { count: 0, held: false }; }
}

/** Load the checkout page from the SERVER cart — resilient to back/forward and
 *  device switches (nothing lives only in the tab). Ensures a LIVE hold so the
 *  charge-first confirm has capacity to convert. Titles + per-line amounts come
 *  from the server quote, so the summary is always the real booking. */
export async function loadCheckoutAction():
  Promise<{ ok: true; data: CheckoutServerData } | { ok: false; reason: "empty" | "unavailable" | "error" }> {
  try {
    const r: any = await stowbo.resumeCheckout();
    if (!r?.resumable) return { ok: false, reason: "empty" };
    // resume() returns the priced lines (quote.lines), NOT a separate items array —
    // and the stored cart already normalised each listing id, so we rebuild the
    // hold input straight from those lines.
    const qlines: any[] = r.quote?.lines ?? [];
    if (!qlines.length) return { ok: false, reason: "empty" };
    const items: BookingItemInput[] = qlines.map((l) => ({ listing: l.listing, startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, addOns: l.addOns }));

    const buildLines = (q: CheckoutQuote | undefined): CheckoutServerLine[] => (q?.lines ?? qlines).map((l: any) => ({
      listing: l.listing, title: l.listingTitle || "Space", startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, amount: l.total,
    }));

    // A live hold — use it as-is (re-holding a live hold would conflict). dueNow
    // isn't re-derivable here, so the page charges the quote total (the common case).
    const returnTo: string | null = r.returnTo ?? null;
    if (r.holdExpiresAt && !r.holdExpired && r.checkoutId) {
      const q: CheckoutQuote = r.quote;
      return { ok: true, data: { checkoutId: r.checkoutId, holdExpiresAt: r.holdExpiresAt, quote: q, currency: q?.currency || CUR, dueNow: q?.total, returnTo, lines: buildLines(q) } };
    }

    // Open cart (no live hold) — take the hold now so we can charge & convert. The
    // cart's discount code rides along so the held price is the discounted one.
    const code = cartCode(r);
    const hold: any = await stowbo.holdCheckout({ items, currency: CUR, ...(returnTo ? { returnTo } : {}), ...(code ? { discountCode: code } : {}) });
    const hd = hold?.data ?? hold;
    if (!hd?.checkoutId) return { ok: false, reason: "unavailable" };
    const q: CheckoutQuote = hd.quote ?? r.quote;
    return {
      ok: true,
      data: { checkoutId: hd.checkoutId, holdExpiresAt: hd.expiresAt, quote: q, currency: hd.currency || q?.currency || CUR, dueNow: hd.dueNow ?? q?.total, dueUpfront: hd.dueUpfront, dueDeposit: hd.dueDeposit, returnTo, lines: buildLines(q) },
    };
  } catch (e: any) {
    if (errCode(e) === "UNAVAILABLE") return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "error" };
  }
}

/** Resume the open cart on this device (server drives what the UI restores). */
export async function resumeCheckoutAction():
  Promise<{ ok: true; resume: CheckoutResume } | { ok: false; notFound?: boolean }> {
  try {
    return { ok: true, resume: await stowbo.resumeCheckout() };
  } catch (e: any) {
    return { ok: false, notFound: is404(e) };
  }
}

/** Step 1 of placing the order: HOLD the capacity for a few minutes (same as the
 *  app). Returns checkoutId + expiresAt for the countdown, and the locked quote. */
export async function holdAction(items: BookingItemInput[]):
  Promise<{ ok: true; checkoutId: string; expiresAt?: string; quote?: CheckoutQuote; dueNow?: number; dueUpfront?: number; dueDeposit?: number; currency?: string } | { ok: false; notFound?: boolean; code?: string; error?: string }> {
  try {
    const hold: any = await stowbo.holdCheckout({ items, currency: CUR });
    const d = hold?.data ?? hold;
    const checkoutId = d?.checkoutId;
    if (!checkoutId) return { ok: false, error: "Could not start checkout." };
    // `dueNow` is what the server actually charges at confirm (upfront% + deposit) —
    // it differs from quote.total for post-pay / partial / deposit listings, so the
    // card step gates and labels on this, not the full total.
    return { ok: true, checkoutId, expiresAt: d?.expiresAt, quote: d?.quote, dueNow: d?.dueNow, dueUpfront: d?.dueUpfront, dueDeposit: d?.dueDeposit, currency: d?.currency };
  } catch (e: any) {
    if (is404(e)) return { ok: false, notFound: true };
    return { ok: false, code: errCode(e), error: getErrorMessage(e, "Could not hold this space. It may have just been taken.") };
  }
}

export type ConfirmedLine = { title: string; startDate?: string; endDate?: string; quantity?: number; amount?: number };
export type Confirmed = {
  reference: string; total?: number; currency?: string;
  status?: string;
  instructions?: string;   // the host's own drop-off / collect instructions
  lines: ConfirmedLine[];
};

/** Step 2: pay & confirm the held checkout → the booking. Returns the booking's
 *  claim codes + line items so the confirmation screen can show what was booked. */
export async function confirmAction(checkoutId: string, paymentMethodId?: string):
  Promise<({ ok: true } & Confirmed) | { ok: false; code?: string; error?: string }> {
  try {
    const res: any = await stowbo.confirmCheckout(checkoutId, { paymentMethodId, captureNow: true });
    const d = res?.data ?? res;
    const items: any[] = Array.isArray(d?.items) ? d.items : [];
    const spaces = items.filter((it) => !it.kind || it.kind === "space");
    const lines: ConfirmedLine[] = spaces
      .map((it) => ({ title: it.listingTitle || it.label || "Space", startDate: it.startDate, endDate: it.endDate, quantity: it.quantity ?? 1, amount: it.amount }));
    // The host's own hand-off instructions, shown right after booking.
    let instructions: string | undefined;
    try {
      const lid = spaces[0]?.listing;
      if (lid) { const l: any = await stowbo.listing(lid); instructions = l?.listing?.data?.bookingInstructions || undefined; }
    } catch { /* non-fatal */ }
    return {
      ok: true,
      reference: d?.reference || d?.name || res?.sk || "booked",
      total: d?.total ?? d?.subtotal,
      currency: d?.currency ?? "USD",
      status: d?.status,
      instructions,
      lines,
    };
  } catch (e: any) {
    return { ok: false, code: errCode(e), error: getErrorMessage(e, "Could not complete checkout.") };
  }
}

/** Abandon the open cart (release any hold). */
export async function abandonCheckoutAction(checkoutId: string): Promise<void> {
  try { await stowbo.abandonCheckout(checkoutId); } catch { /* best effort */ }
}

/** Release the hold (hand the capacity back) but KEEP the cart so the shopper can
 *  come back to it — used when they choose to leave checkout. The hold is simply
 *  re-taken next time they open /checkout. */
export async function releaseHoldKeepCartAction(checkoutId: string): Promise<void> {
  try {
    let items: BookingItemInput[] = [];
    let returnTo: string | undefined;
    let code: string | undefined;
    try {
      const r: any = await stowbo.resumeCheckout();
      if (r?.resumable) {
        items = (r.quote?.lines ?? []).map((l: any) => ({ listing: l.listing, startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, addOns: l.addOns }));
        returnTo = r.returnTo || undefined;
        code = cartCode(r);
      }
    } catch { /* ignore */ }
    await stowbo.abandonCheckout(checkoutId);              // free the capacity now
    if (items.length) await stowbo.saveCart({ items, currency: CUR, step: "cart", ...(returnTo ? { returnTo } : {}), ...(code ? { discountCode: code } : {}) }); // but keep the cart
  } catch { /* best effort */ }
}

/* ── the header cart DRAWER — look at the cart WITHOUT starting checkout ── */
export type CartViewLine = { listing: string; title: string; startDate?: string; endDate?: string; quantity?: number; amount?: number };
export type CartView = {
  checkoutId: string; held: boolean; holdExpiresAt?: string | null; currency: string; total: number; returnTo?: string | null; lines: CartViewLine[];
  subtotal?: number; fees?: { label: string; amount: number }[];
  discountCode?: string | null; discounts?: { code?: string; label: string; amount: number }[]; discountRejected?: { code?: string; message?: string } | null;
};

/** Read the open cart as-is (re-priced by the server) and take NO hold. Viewing
 *  the cart is not an intent to buy — the hold belongs to /checkout only. */
export async function cartViewAction(): Promise<CartView | null> {
  try {
    const r: any = await stowbo.resumeCheckout();
    if (!r?.resumable) return null;
    const q: CheckoutQuote | undefined = r.quote;
    const lines: CartViewLine[] = (q?.lines ?? []).map((l: any) => ({
      listing: l.listing, title: l.listingTitle || "Space", startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, amount: l.total,
    }));
    if (!lines.length) return null;
    const held = !!(r.holdExpiresAt && !r.holdExpired);
    const fees = (q?.fees?.length ? q.fees : (q?.lines ?? []).flatMap((l) => l.fees ?? [])).map((f) => ({ label: f.label, amount: f.amount }));
    return {
      checkoutId: r.checkoutId, held, holdExpiresAt: held ? r.holdExpiresAt : null, currency: q?.currency || CUR, total: Number(q?.total ?? 0), returnTo: r.returnTo ?? null, lines,
      subtotal: q?.subtotal, fees,
      discountCode: cartCode(r) ?? null,
      discounts: (q?.discounts ?? []).map((d) => ({ code: d.code, label: d.name || d.label || (d.code ? `Code ${d.code}` : "Discount"), amount: d.amount })),
      discountRejected: q?.discountRejected ?? null,
    };
  } catch { return null; }
}

/** Drop one line from the cart (matched by listing + dates). A live hold is
 *  released first — the server refuses to edit lines under claimed capacity —
 *  and the hold is simply re-taken when they next open /checkout. Removing the
 *  last line abandons the cart outright. */
export async function removeCartLineAction(line: { listing: string; startDate?: string; endDate?: string }):
  Promise<{ ok: true; count: number } | { ok: false; error?: string }> {
  try {
    const r: any = await stowbo.resumeCheckout();
    if (!r?.resumable) return { ok: true, count: 0 };
    const key = (l: any) => `${l.listing}|${l.startDate}|${l.endDate}`;
    const target = key(line);
    const existing: BookingItemInput[] = (r.quote?.lines ?? []).map((l: any) => ({ listing: l.listing, startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, addOns: l.addOns }));
    const kept = existing.filter((l) => key(l) !== target);
    const liveHold = r.holdExpiresAt && !r.holdExpired && r.checkoutId;
    if (!kept.length) {
      // Nothing left — abandon the cart (also frees any hold).
      if (r.checkoutId) await stowbo.abandonCheckout(r.checkoutId);
      return { ok: true, count: 0 };
    }
    if (liveHold) { try { await stowbo.abandonCheckout(r.checkoutId); } catch { /* best effort */ } }
    const code = cartCode(r);
    await stowbo.saveCart({ items: kept, currency: CUR, step: "cart", ...(r.returnTo ? { returnTo: r.returnTo } : {}), ...(code ? { discountCode: code } : {}) });
    return { ok: true, count: kept.length };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not update your cart.") };
  }
}

/** Put a discount code on the open cart (or clear it with ""). The server validates and
 *  re-prices; a code that doesn't take comes back as `discountRejected` with the
 *  storefront's reason, never as a silent no-op. A live hold is released first (the
 *  server won't re-price held lines) and simply re-taken when /checkout next loads. */
export async function applyCartCodeAction(code: string):
  Promise<{ ok: true; view: CartView | null } | { ok: false; error?: string }> {
  try {
    const r: any = await stowbo.resumeCheckout();
    if (!r?.resumable) return { ok: true, view: null };
    const items: BookingItemInput[] = (r.quote?.lines ?? []).map((l: any) => ({ listing: l.listing, startDate: l.startDate, endDate: l.endDate, quantity: l.quantity, addOns: l.addOns }));
    if (!items.length) return { ok: true, view: null };
    if (r.holdExpiresAt && !r.holdExpired && r.checkoutId) { try { await stowbo.abandonCheckout(r.checkoutId); } catch { /* best effort */ } }
    const trimmed = code.trim();
    await stowbo.saveCart({ items, currency: CUR, step: "cart", ...(r.returnTo ? { returnTo: r.returnTo } : {}), ...(trimmed ? { discountCode: trimmed } : {}) });
    return { ok: true, view: await cartViewAction() };
  } catch (e: any) {
    return { ok: false, error: getErrorMessage(e, "Could not apply that code.") };
  }
}
