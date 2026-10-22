'use client';

// from base-app/src/components/storefront/boutique/BundleContents.tsx — ported verbatim; only import paths rewired.
/**
 * What a bundle (set) contains, on its product page. A bundle product keeps its
 * parts in `data.bundle` ([{ sk, sku, name, quantity? }]); without this the set
 * looked like a plain product and the shopper couldn't see what they'd get.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';

interface BundleItem {
  sk?: string;
  sku?: string;
  name?: string;
  quantity?: number;
}

export const BundleContents: React.FC<{ items?: BundleItem[]; className?: string }> = ({ items, className }) => {
  const parts = (Array.isArray(items) ? items : []).filter((item) => item && (item.sku || item.name));
  // Parts open on the same store page as this set (/store/<set> -> /store/<part>).
  const root = (usePathname() || '/store/').split('/').filter(Boolean).slice(0, -1).join('/') || 'store';
  const [images, setImages] = useState<Record<string, string>>({});
  const key = parts.map((item) => item.sku).join(',');

  useEffect(() => {
    let live = true;
    parts.forEach((item) => {
      if (!item.sku) return;
      storefrontAPI
        .getProduct(item.sku)
        .then((product: any) => {
          // getProduct hands back the record or its data, depending on the route.
          const url = product?.data?.image || product?.data?.images?.[0]?.url || product?.image || product?.images?.[0]?.url;
          if (live && url) setImages((previous) => ({ ...previous, [item.sku!]: url }));
        })
        .catch(() => {});
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (parts.length === 0) return null;

  return (
    <div className={className}>
      <h3 className="text-base md:text-lg font-semibold text-heading mb-2">What's in the set</h3>
      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
        {parts.map((item, index) => {
          const quantity = Math.max(1, Number(item.quantity) || 1);
          const image = item.sku ? images[item.sku] : undefined;
          const row = (
            <>
              <span className="w-12 h-12 flex-shrink-0 rounded bg-gray-50 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {image && <img src={image} alt={item.name || item.sku} className="w-full h-full object-cover" />}
              </span>
              <span className="text-sm text-gray-900">
                <span className="font-medium">{quantity} ×</span> {item.name || item.sku}
              </span>
            </>
          );
          return (
            <li key={`${item.sku || item.name}-${index}`}>
              {item.sku ? (
                <Link href={`/${root}/${encodeURIComponent(item.sku)}`} className="flex items-center gap-3 p-2 hover:bg-gray-50">
                  {row}
                </Link>
              ) : (
                <div className="flex items-center gap-3 p-2">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
