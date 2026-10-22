// from base-app/src/components/storefront/checkout-payment.ts — ported verbatim; only import paths rewired.
import { GIFT_CARDS_ONLY } from './gift-card/checkout-gift-cards';

/**
 * Offline selection is an unpaid order. A checkout paid in full by gift cards and/or store credit / points
 * (reference GIFT_CARDS_ONLY) has no gateway payment: the server spends those with the order and records each.
 */
export function checkoutPayment(checkout: { paymentGateway?: string; total?: number; currency?: string }, reference: string) {
  if (reference === GIFT_CARDS_ONLY || checkout.paymentGateway === 'offline') {
    return { paymentRef: undefined, paymentGateway: undefined, transaction: undefined };
  }
  return {
    paymentRef: reference,
    paymentGateway: checkout.paymentGateway,
    transaction: {
      captureInfo: { status: 'succeeded', amount: checkout.total, currency: checkout.currency },
      gateway: checkout.paymentGateway,
      ref: reference,
    },
  };
}

/** The machine code a refusal carries (`{ code: 'NOT_ENOUGH_POINTS', message }`), wherever the HTTP client put the body. */
export function responseErrorCode(error: any): string | undefined {
  for (const payload of [error?.response?.data, error, error?.data]) {
    const code = payload?.code ?? payload?.error?.code;
    if (typeof code === 'string' && code) return code;
  }
  return undefined;
}
