// from base-app/src/components/storefront/checkout-quote.ts — ported verbatim; only import paths rewired.
/** A payment form may only use a successful quote for its current request. */
export function checkoutQuoteReady({ summary, loading, error, quotedKey, currentKey }: {
  summary: unknown; loading: boolean; error: string | null;
  quotedKey: string | null; currentKey: string;
}): boolean {
  return !!summary && !loading && !error && quotedKey === currentKey;
}

/** Applying a code selects it; only the destination-aware quote may publish totals. */
export async function selectCheckoutCoupon({ code, request, select }: {
  code: string; request: () => Promise<any>; select: (code: string) => void;
}): Promise<any> {
  const result = await request();
  if (result?.valid) select(code);
  return result;
}

/**
 * The cart the shop keeps for a checkout quote. The server builds the order from
 * the stored cart and refuses a card amount that is not that cart's total, so the
 * checkout stores exactly what it quoted — before the card form can use the quote.
 * (Until Oct 2026 only the cart drawer stored it: three products added from their
 * pages were charged, and the order held the one an earlier drawer had stored.)
 * Gift card codes, PINs, the shopper's store credit / points and what they cover are never stored on the cart.
 */
export function checkoutCartRecord(summary: any, context: { couponCode?: string; shippingAddress?: any; email?: string }) {
  const { giftCards, giftCardTotal, amountDue, giftCardExcluded, giftCardExcludedReason, wallet, walletTotal, rewardPointsLines, ...cart } = summary || {};
  return {
    ...cart,
    productItems: cart.productItems || [],
    rentalItems: cart.rentalItems || [],
    couponCode: context.couponCode || undefined,
    shippingAddress: context.shippingAddress,
    email: context.email,
  };
}
