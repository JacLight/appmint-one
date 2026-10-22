// from base-app/src/components/storefront/utils/cart-line-pricing.ts — ported verbatim; only import paths rewired.
import { optionsFingerprint } from './custom-attributes';

/** A SKU alone cannot identify two differently personalised cart lines. */
export function findPricedProductLine(lines: any[] | undefined, item: any) {
  if (!lines) return undefined;
  if (item.cartItemId) {
    const exact = lines.find((line) => line.cartItemId === item.cartItemId);
    if (exact) return exact;
  }
  const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
  const selected = optionsFingerprint(item.options);
  return lines.find((line) => norm(line.sku) === norm(item.sku) && optionsFingerprint(line.options) === selected);
}
