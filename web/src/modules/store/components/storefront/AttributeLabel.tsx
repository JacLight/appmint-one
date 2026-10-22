'use client';

// from base-app/src/components/storefront/AttributeLabel.tsx — ported verbatim; only import paths rewired.
/**
 * Shows an attribute the way the shop named it: its title ("Your artwork", "Colour")
 * and the option label ("Natural"), not the stored system name and value
 * ("pd-artwork", "natural"). Cart, checkout and the order confirmation stored only
 * the name/value on the line, so they printed the raw keys.
 */

import React, { useEffect, useState } from 'react';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import { definitionCache } from './hooks/useProductAttributeDefs';

const pending = new Map<string, Promise<void>>();

const load = (name: string): Promise<void> => {
  if (definitionCache.has(name)) return Promise.resolve();
  if (!pending.has(name)) {
    pending.set(
      name,
      storefrontAPI
        .getAttributeDefinitions([name])
        .then((defs) => { definitionCache.set(name, defs[name] || null); })
        .catch(() => { definitionCache.set(name, null); })
        .finally(() => pending.delete(name)),
    );
  }
  return pending.get(name)!;
};

const prettify = (name: string) => name.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

const useDef = (name: string) => {
  const [, setTick] = useState(0);
  const readyAtRender = !name || definitionCache.has(name);
  useEffect(() => {
    if (!name) return;
    // Another label may have loaded it between this render and the effect.
    if (definitionCache.has(name)) { if (!readyAtRender) setTick((t) => t + 1); return; }
    let live = true;
    load(name).then(() => live && setTick((t) => t + 1));
    return () => { live = false; };
  }, [name, readyAtRender]);
  return { ready: !name || definitionCache.has(name), def: definitionCache.get(name) || null };
};

export const AttributeTitle: React.FC<{ name: string }> = ({ name }) => {
  const { ready, def } = useDef(name);
  // Until the definition arrives, show nothing rather than the system name.
  if (!ready) return <span className="inline-block w-12 h-3 align-middle rounded bg-gray-100" aria-hidden />;
  return <>{def?.title || prettify(name)}</>;
};

export const AttributeValue: React.FC<{ name: string; value: any }> = ({ name, value }) => {
  const { def } = useDef(name);
  const option = def?.options?.find((entry: any) => entry?.value === value);
  return <>{option?.label || String(value)}</>;
};
