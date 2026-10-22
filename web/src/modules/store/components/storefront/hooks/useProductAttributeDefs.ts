// from base-app/src/components/storefront/hooks/useProductAttributeDefs.ts — ported verbatim; only import paths rewired.
/**
 * Resolves the `sf_attribute` definitions a product references.
 *
 * A product stores only `{ name, options }` per attribute. Whether that
 * attribute is a preset selector or something the shopper fills in (`text` /
 * `file`), and how a file input is configured (`multiple` / `accept` /
 * `maxFiles`), lives on the attribute record — so the product page has to fetch
 * it before it can render the right control.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import type { Product } from '../utils/product-helpers';
import type { AttributeDef } from '../utils/custom-attributes';

/** Definitions rarely change; cache across product views for the session. */
export const definitionCache = new Map<string, AttributeDef | null>();

export function useProductAttributeDefs(product: Product) {
  const [defs, setDefs] = useState<Record<string, AttributeDef>>({});
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  const attributeNames = useMemo(() => {
    const attributes = product?.data?.attributes;
    if (!Array.isArray(attributes)) return [];
    return Array.from(new Set(attributes.map((attribute: any) => attribute?.name).filter(Boolean)));
  }, [product?.data?.attributes]);

  // Stable dependency - the array identity changes on every render otherwise
  const namesKey = attributeNames.join(',');

  useEffect(() => {
    if (attributeNames.length === 0) {
      setDefs({});
      return;
    }

    const requestId = ++requestRef.current;

    const cached: Record<string, AttributeDef> = {};
    const missing: string[] = [];
    attributeNames.forEach((name) => {
      if (definitionCache.has(name)) {
        const def = definitionCache.get(name);
        if (def) cached[name] = def;
      } else {
        missing.push(name);
      }
    });

    setDefs(cached);

    if (missing.length === 0) return;

    let cancelled = false;
    setLoading(true);

    storefrontAPI
      .getAttributeDefinitions(missing)
      .then((fetched) => {
        // Cache misses too, so a product referencing a deleted attribute
        // doesn't refetch on every mount
        missing.forEach((name) => definitionCache.set(name, fetched[name] || null));
        if (cancelled || requestId !== requestRef.current) return;
        setDefs((previous) => ({ ...previous, ...fetched }));
      })
      .catch((error) => {
        console.error('Failed to load attribute definitions:', error);
        // Don't hold the choices back forever: fall back to the product's own attribute names.
        missing.forEach((name) => { if (!definitionCache.has(name)) definitionCache.set(name, null); });
        if (!cancelled && requestId === requestRef.current) setDefs((previous) => ({ ...previous }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey]);

  // Ready once every referenced attribute has been looked up (a miss is cached as null). Until then
  // the page doesn't know which are uploads/text and what their titles are, so it would show
  // system names ("pd-artwork") for a moment.
  const defsReady = attributeNames.every((name) => definitionCache.has(name));
  return { attributeDefs: defs, loadingDefs: loading, defsReady };
}
