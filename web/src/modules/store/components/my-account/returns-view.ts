// from base-app/src/components/my-account/returns-view.ts — ported verbatim; only import paths rewired.
/**
 * Customer returns (F-SF-RET-014): what a customer may return from an order, the
 * request the returns API expects, and which actions an RMA offers its customer.
 * The server still decides everything (ownership, prices, the 30-day window, how
 * many are left); this only keeps the screen from offering what it will refuse.
 */

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'shipped' | 'received' | 'inspecting' | 'completed' | 'cancelled';

export const RETURN_REASONS: { value: string; label: string }[] = [
  { value: 'defective', label: 'It is faulty' },
  { value: 'damaged_shipping', label: 'It arrived damaged' },
  { value: 'wrong_item', label: 'Wrong item sent' },
  { value: 'not_as_described', label: 'Not as described' },
  { value: 'changed_mind', label: 'I changed my mind' },
  { value: 'other', label: 'Something else' },
];

/** The condition the customer says the item is in (returns course, 11 Oct: it was guessed from the reason, so a
 * still-wrapped item sent back for "changed my mind" arrived in Studio as "Opened"). */
export const RETURN_CONDITIONS: { value: string; label: string }[] = [
  { value: 'unopened', label: 'Unopened, still in its packaging' },
  { value: 'opened', label: 'Opened or used' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'defective', label: 'Faulty' },
  { value: 'wrong_item', label: 'Wrong item' },
];
/** The condition a reason suggests, until the customer picks one. */
export const conditionForReason = (reasonCategory: string) =>
  reasonCategory === 'defective' ? 'defective' : reasonCategory === 'damaged_shipping' ? 'damaged' : reasonCategory === 'wrong_item' ? 'wrong_item' : 'opened';

export const RETURN_STATUS: Record<string, { label: string; cls: string; note: string }> = {
  requested: { label: 'Requested', cls: 'bg-amber-100 text-amber-700', note: 'The store is reviewing your request.' },
  approved: { label: 'Approved', cls: 'bg-blue-100 text-blue-700', note: 'Send the items back, then tell us the tracking number.' },
  rejected: { label: 'Declined', cls: 'bg-red-100 text-red-700', note: 'The store declined this return.' },
  shipped: { label: 'On its way back', cls: 'bg-blue-100 text-blue-700', note: 'The store will check the items when they arrive.' },
  received: { label: 'Received', cls: 'bg-indigo-100 text-indigo-700', note: 'The store has your items.' },
  inspecting: { label: 'Being checked', cls: 'bg-indigo-100 text-indigo-700', note: 'The store is checking the items.' },
  completed: { label: 'Completed', cls: 'bg-green-100 text-green-700', note: 'This return is finished.' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600', note: 'This return was cancelled.' },
};

/** Orders that can't have anything to send back yet (or any more). */
const NOT_RETURNABLE = new Set(['new', 'awaiting-payment', 'failed', 'cancelled', 'refunded', 'returned']);

export function orderCanRequestReturn(order: any): boolean {
  const od = order?.data || order || {};
  if (NOT_RETURNABLE.has(String(od.status || 'new'))) return false;
  return (od.productItems || []).some((it: any) => it?.sku && Number(it?.quantity) > 0);
}

/** Units of each SKU already in a return that is still going ahead (not declined or cancelled). */
export function alreadyAsked(returns: any[], orderNumber: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of returns || []) {
    const d = r?.data || r || {};
    if (d.orderNumber !== orderNumber || d.status === 'rejected' || d.status === 'cancelled') continue;
    for (const it of d.items || []) {
      const key = String(it?.sku || '');
      out.set(key, (out.get(key) || 0) + (Number(it?.returnQuantity) || 0));
    }
  }
  return out;
}

export interface ReturnableLine { sku: string; name: string; image?: string; unitPrice: number; bought: number; left: number }

/** The order's product lines, merged by SKU, with how many of each can still be returned. */
export function returnableLines(order: any, returns: any[] = []): ReturnableLine[] {
  const od = order?.data || order || {};
  const asked = alreadyAsked(returns, od.number);
  const bySku = new Map<string, ReturnableLine>();
  for (const it of od.productItems || []) {
    const sku = String(it?.sku || '');
    const qty = Number(it?.quantity) || 0;
    if (!sku || qty <= 0) continue;
    const line = bySku.get(sku) || { sku, name: it.name || sku, image: it.image, unitPrice: Number(it.unitPrice) || 0, bought: 0, left: 0 };
    line.bought += qty;
    bySku.set(sku, line);
  }
  return [...bySku.values()].map((l) => ({ ...l, left: Math.max(0, l.bought - (asked.get(l.sku) || 0)) }));
}

/** The body for POST storefront/returns/request, or the reason it can't be sent yet. */
export function buildReturnRequest(
  order: any,
  lines: ReturnableLine[],
  picked: Record<string, number>,
  reasonCategory: string,
  details: string,
  condition?: string,
): { ok: true; body: any } | { ok: false; problem: string } {
  const od = order?.data || order || {};
  const items = lines
    .map((l) => ({ l, qty: Math.floor(Number(picked[l.sku]) || 0) }))
    .filter(({ qty }) => qty > 0);
  if (!items.length) return { ok: false, problem: 'Choose at least one item and how many to return.' };
  const over = items.find(({ l, qty }) => qty > l.left);
  if (over) return { ok: false, problem: `Only ${over.l.left} of ${over.l.name} can be returned.` };
  if (!RETURN_REASONS.some((r) => r.value === reasonCategory)) return { ok: false, problem: 'Tell us why you are returning it.' };
  const label = RETURN_REASONS.find((r) => r.value === reasonCategory)!.label;
  const reason = details.trim() || label;
  return {
    ok: true,
    body: {
      orderNumber: od.number,
      reasonCategory,
      reason,
      type: 'return',
      items: items.map(({ l, qty }) => ({
        sku: l.sku,
        name: l.name,
        quantity: l.bought,
        returnQuantity: qty,
        price: l.unitPrice, // informational; the server prices from the order
        reason,
        condition: RETURN_CONDITIONS.some((c) => c.value === condition) ? condition : conditionForReason(reasonCategory),
      })),
    },
  };
}

/** The customer sends the parcel once the store approved the return. */
export const canMarkShipped = (status: string) => status === 'approved';
/** The customer can withdraw a return until it is on its way back. */
export const canCancelReturn = (status: string) => status === 'requested' || status === 'approved';

/** The words a failed API call carries, for showing to the customer. */
export function serverWords(err: any, fallback: string): string {
  const e = err?.response?.data?.error ?? err?.response?.data?.message ?? err?.response?.data;
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object') {
    const m = e.message ?? e.error;
    if (typeof m === 'string' && m.trim()) return m;
    if (Array.isArray(m) && m.length) return String(m[0]);
  }
  return err?.message || fallback;
}
