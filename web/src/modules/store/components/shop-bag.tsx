'use client';
// The header bag for the shop: opens base-app's Cart drawer (zustand cart) and shows its
// count. base-app mounts <Cart> once in its layout; here the header is on every page, so
// the drawer is mounted with the bag. The drawer's own floating button is hidden
// (tokens.css) because the header bag is the trigger.
import '../tokens.css';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCartStore } from '@/modules/store/store/cart-store';
import { Cart } from '@/modules/store/components/storefront/Cart';
import { Icon } from '@/modules/store/components/icons';

export function ShopBag({ label = 'Bag', storePage = 'shop' }: { label?: string; storePage?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = useCartStore((s) => s.items.reduce((n, i) => n + (Number(i.quantity) || 0), 0));
  const toggleCart = useCartStore((s) => s.toggleCart);
  const n = mounted ? count : 0;
  return (
    <>
      <button type="button" className="sf-bagbtn" aria-label={`${label}${n ? `, ${n} item${n === 1 ? '' : 's'}` : ''}`} onClick={toggleCart}>
        <Icon name="bag" size={21} />
        {n > 0 && <span className="sf-bagbtn-n">{n}</span>}
      </button>
      {/* Portalled to <body>: the header is a containing block for fixed children, which trapped the drawer in it. */}
      {mounted && createPortal(<div className="sf-store sf-store-cart"><Cart storePage={storePage} /></div>, document.body)}
    </>
  );
}

/** /shop/cart: open the drawer over the page. */
export function OpenCart() {
  const open = useCartStore((s) => s.isOpen);
  const hydrated = useCartStore((s) => s._hasHydrated);
  const toggleCart = useCartStore((s) => s.toggleCart);
  useEffect(() => { if (hydrated && !open) toggleCart(); }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
