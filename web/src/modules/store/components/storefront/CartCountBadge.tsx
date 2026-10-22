'use client';

// from base-app/src/components/storefront/CartCountBadge.tsx — ported verbatim; only import paths rewired.
import React from 'react';

/**
 * Superscript item count for a cart icon. Sits on the icon's top-right corner,
 * grows sideways for 2–3 digit counts and never wraps to a second line.
 */
export function CartCountBadge({ count, className = '' }: { count: number; className?: string }) {
  if (!count || count < 1) return null;
  return (
    <span
      className={`absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none whitespace-nowrap tabular-nums pointer-events-none ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export default CartCountBadge;
