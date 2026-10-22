// from base-app/src/components/storefront/order-payment-status.ts — ported verbatim; only import paths rewired.
export function orderPaymentStatus(order: any): string {
  const status = String(order?.paymentStatus || order?.status || '').toLowerCase();
  if (status === 'refunded') return 'Refunded';
  // Part of the money went back (a return, a goodwill refund): say so instead of plain "Paid".
  if (status === 'partially_refunded' || status === 'partially-refunded' || Number(order?.totalRefunded) > 0) return 'Partially refunded';
  if (status === 'paid-partial') return 'Partially paid';
  if (status === 'paid' || status === 'overpaid') return 'Paid';
  const received = (Array.isArray(order?.payments) ? order.payments : []).reduce(
    (sum: number, payment: any) => sum + (Number(payment.amount) || 0), 0,
  );
  if (received > 0 && received >= Number(order?.amount)) return 'Paid';
  if (received > 0) return 'Partially paid';
  return 'Awaiting payment';
}
