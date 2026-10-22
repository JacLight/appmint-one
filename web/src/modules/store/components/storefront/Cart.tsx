'use client';

// from base-app/src/components/storefront/Cart.tsx — ported verbatim; only import paths rewired.
import React, { useState, useEffect, useRef } from 'react';
import { showRentalDate, rentalUnit } from '@/modules/store/components/rental/dates';
import Link from 'next/link';
import { useCartStore } from '@/modules/store/store/cart-store';
import { activeSession } from '@/modules/store/lib/active-session';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import { isEmpty } from '@/modules/store/lib-client/helpers';
import { findPricedProductLine } from './utils/cart-line-pricing';
import { LineItemOptions } from './LineItemOptions';
import { AttributeTitle, AttributeValue } from './AttributeLabel';
import { CartCountBadge } from './CartCountBadge';
import { Loader2, Calendar, ShoppingBag, X, Trash2, Minus, Plus, RefreshCw, Building2, Lock } from 'lucide-react';

const fmt = (v: any) => (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // Appmint One: thousands separators

/** Shown in place of an amount the server has not priced yet — never a made-up $0.00. */
const Pricing = () => (
  <span className="inline-flex items-center gap-1 text-gray-400" aria-label="Calculating price">
    <Loader2 className="w-3 h-3 animate-spin" />
  </span>
);

export function Cart({ storePage }: { siteOrgId?: string; storePage?: string }) {
  const [isMounted, setIsMounted] = useState(false);
  // Start from the store's server price for this cart (the store clears it on every change), so the drawer opens priced.
  const [pricing, setPricing] = useState<any>(() => useCartStore.getState().serverPricing);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [pricingError, setPricingError] = useState<string | null>(null);
  const cartIdRef = useRef<string | undefined>(undefined);

  // The shared account this shopper is buying for, if any (set on the account page).
  const sessionCustomer: any = isMounted ? activeSession.getUser() : null;
  const sharedAccountId = sessionCustomer?.data?.sharedAccountId;
  const orderingFor: string = sharedAccountId
    ? (sessionCustomer?.data?.sharedAccounts || []).find((a: any) => a?.id === sharedAccountId)?.name || 'a shared account'
    : '';

  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const getItemCount = useCartStore((state) => state.getItemCount);
  const clearCart = useCartStore((state) => state.clearCart);
  const isOpen = useCartStore((state) => state.isOpen);
  const toggleCart = useCartStore((state) => state.toggleCart);
  const getProductItems = useCartStore((state) => state.getProductItems);
  const getRentalItems = useCartStore((state) => state.getRentalItems);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const productItems = isMounted ? getProductItems() : [];
  const rentalItems = isMounted ? getRentalItems() : [];

  // Fetch pricing from server
  const fetchPricing = async () => {
    const request = ++requestRef.current;
    setPricingError(null);
    const currentProductItems = getProductItems();
    const currentRentalItems = getRentalItems();

    if (currentProductItems.length === 0 && currentRentalItems.length === 0 && !cartIdRef.current) {
      setPricing(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Keep the last priced figures on screen (dimmed while loading) instead of
    // clearing them, which showed every amount as $0.00 until the server replied.
    try {
      // Send productItems and rentalItems separately per SDK sf-cart schema
      // Include cartId if we have one from a previous call
      const result = await storefrontAPI.calculateCartPrices({
        productItems: currentProductItems,
        rentalItems: currentRentalItems,
        cartId: cartIdRef.current,
      });
      if (request !== requestRef.current) return;
      // Save cartId from response for subsequent calls
      if (result?.cartId) {
        cartIdRef.current = result.cartId;
      }
      await storefrontAPI.persistPricedCart(result);
      if (request !== requestRef.current) return;
      setPricing(result);
    } catch (error) {
      if (request === requestRef.current) setPricingError('Could not update your cart. Use Refresh cart to try again.');
      console.error('[Cart] Failed to fetch pricing:', error);
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };

  // Reprice whenever an open cart changes, including a newly added design.
  useEffect(() => {
    if (isMounted && isOpen) fetchPricing();
    return () => { requestRef.current++; };
  }, [isMounted, isOpen, items]);

  const restoreSavedCart = async () => {
    setRestoring(true);
    setRestoreMessage('');
    try {
      const saved = await storefrontAPI.getSavedCart();
      const data = saved?.data;
      const recovered = [
        ...(data?.productItems || []).map((item: any) => ({ ...item, itemType: 'product' })),
        ...(data?.rentalItems || []).map((item: any) => ({ ...item, itemType: 'rental' })),
      ];
      if (!recovered.length) { setRestoreMessage('There are no items in your saved cart.'); return; }
      if (!useCartStore.getState().items.length) cartIdRef.current = saved.sk;
      if (!useCartStore.getState().restoreSavedCart(recovered)) setRestoreMessage('Your current items were kept.');
    } catch {
      setRestoreMessage('Could not restore your saved cart. Sign in again if your session expired, then retry.');
    } finally { setRestoring(false); }
  };

  const handleToggleCart = () => toggleCart();

  // Handle quantity change
  const handleQuantityChange = (cartItemId: string, newQty: number) => {
    updateQuantity(cartItemId, newQty);
  };

  // Handle remove item
  const handleRemoveItem = (cartItemId: string) => {
    removeItem(cartItemId);
  };

  const handleCheckout = () => {
    toggleCart();
    const currentPath = window.location.pathname;
    if (currentPath.includes('/preview/')) {
      window.location.href = '/preview/checkout';
    } else {
      window.location.href = `/${storePage || 'store'}/checkout`; // Appmint One: /{storePage}/checkout
    }
  };

  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return '';
    return `${showRentalDate(startDate)} - ${showRentalDate(endDate)}`;
  };

  // Display values from server - no client-side calculations (matches SDK sf-cart schema)
  const displayItemCount = isMounted ? getItemCount() : 0;
  const displayProductTotal = pricing?.productSubtotal ?? 0;
  const displayTotal = pricing?.total ?? 0;

  const hasItems = items.length > 0;

  return (
    <>
      {/* Cart Button */}
      <button
        onClick={handleToggleCart}
        data-chrome="cart"
        className="relative sm:fixed sm:bottom-48 sm:right-6 z-40 flex items-center justify-center gap-2 h-12 px-4 sm:w-12 sm:px-0 rounded-full bg-black/50 text-white shadow-lg hover:bg-primary/90 transition-colors"
        aria-label={`Open cart${isMounted && hasItems ? ` (${displayItemCount} items)` : ''}`}
        aria-expanded={isOpen}
      >
        <div className="relative">
          <ShoppingBag className="w-5 h-5" />
          {isMounted && <CartCountBadge count={displayItemCount} />}
        </div>
        <span className="text-sm font-medium sm:hidden">Cart</span>
      </button>

      {/* Cart Drawer — above site chrome. A template's own header is
          `sticky top-0 z-50` and, being later in the document, won an equal-z
          tie, covering this drawer's close button so it could not be shut. */}
      {/* Appmint One: the store's bag look — scrim, wide drawer, big line photos, one checkout button. */}
      {isOpen && <button type="button" className="sf-cart-scrim" onClick={handleToggleCart} aria-label="Close bag" />}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
        className={`sf-cart fixed top-0 right-0 z-[100] w-full h-full transform transition-transform duration-300 ease-in-out ${
          // Closed, the drawer sits just off the right edge: its shadow would show as a grey strip there.
          isOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full shadow-none'
        }`}
      >
        <div className="flex flex-col h-full max-h-screen">
          {/* Header */}
          <div className="sf-cart-hd">
            <h2>Your bag{isMounted && hasItems ? <span> · {displayItemCount}</span> : null}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchPricing()}
                disabled={loading}
                className="sf-iconbtn"
                aria-label="Refresh prices"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleToggleCart}
                className="sf-iconbtn"
                aria-label="Close bag"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Who this cart is for. Buying for a shared account prices every line
              as that account, so the shopper sees it here, where the prices are. */}
          {isMounted && orderingFor && (
            <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-sm text-blue-900">
              <span className="flex items-center gap-2 min-w-0">
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate">Ordering for <strong>{orderingFor}</strong></span>
              </span>
              <Link href="/account/shared-accounts" onClick={handleToggleCart} className="shrink-0 text-blue-700 underline">
                Change
              </Link>
            </div>
          )}

          {/* Cart Items */}
          <div className="sf-cart-body">
            {!isMounted || !hasItems ? (
              <div className="sf-cart-empty">
                <span className="sf-cart-empty-ic"><ShoppingBag className="w-7 h-7" /></span>
                <h3>Your bag is empty</h3>
                <p>Find something you'll keep for years.</p>
                {isMounted && activeSession.getUser() && <button type="button" disabled={restoring} onClick={restoreSavedCart} className="sf-btn ghost">
                  {restoring ? 'Restoring saved cart…' : 'Restore saved cart'}
                </button>}
                {isMounted && !activeSession.getUser() && <Link href={`/login?redirect=${encodeURIComponent(`/${storePage || 'store'}`)}`} onClick={handleToggleCart} className="sf-link">Sign in to restore your saved cart</Link>}
                {restoreMessage && <p role="status" className="sf-fine">{restoreMessage}</p>}
                <Link href={`/${storePage || 'store'}`} className="sf-btn" onClick={handleToggleCart}>
                  Continue shopping
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Products Section */}
                {productItems.length > 0 && (
                  <div>
                    {rentalItems.length > 0 && <h3 className="sf-cart-sec"><ShoppingBag className="w-4 h-4" />Products ({productItems.length})</h3>}
                    <div className="sf-cart-lines">
                      {productItems.map((item, index) => {
                        // Get server pricing for this item if available (SDK sf-cart schema)
                        const serverItem = findPricedProductLine(pricing?.productItems, item);
                        const unitPrice = serverItem?.unitPrice ?? item.unitPrice ?? 0;
                        const originalPrice = serverItem?.originalPrice ?? item.originalPrice ?? unitPrice;
                        // Line money comes from the server. Multiplying unit price by
                        // quantity here produces a figure the invoice may not agree with
                        // once a price rule or tier is applied server-side.
                        const lineTotal = serverItem?.amount ?? item.amount ?? 0;
                        const hasDiscount = originalPrice > unitPrice;
                        const appliedRule = serverItem?.appliedRule;
                        const discountPercent = serverItem?.discountPercent;
                        const savings = serverItem?.discount ?? item.discount ?? 0;

                        return (
                          <div
                            key={item.cartItemId || `product-${item.id}-${item.sku}-${index}`}
                            className="sf-cart-line"
                          >
                            <Link href={`/${storePage || 'store'}/${encodeURIComponent(item.sku)}`} className="sf-cart-img" onClick={handleToggleCart} tabIndex={-1} aria-hidden="true">
                              {item.image && <img src={item.image} alt="" />}
                            </Link>
                            <div className="sf-cart-main">
                              <div className="sf-cart-top">
                                <Link
                                  href={`/${storePage || 'store'}/${encodeURIComponent(item.sku)}`}
                                  className="sf-cart-name"
                                  onClick={handleToggleCart}
                                >
                                  {item.name}
                                </Link>
                                <span className={`sf-cart-amt ${loading ? 'busy' : ''} ${hasDiscount ? 'save' : ''}`}>
                                  {serverItem ? `$${fmt(lineTotal)}` : <Pricing />}
                                </span>
                              </div>
                              {/* Unit price & quantity breakdown */}
                              <div className="sf-cart-meta">
                                {hasDiscount ? (
                                  <div className="space-y-0.5">
                                    <div>
                                      <span className="line-through mr-1">${fmt(originalPrice)}</span>
                                      <span className="text-emerald-600 font-medium">${fmt(unitPrice)}/ea</span>
                                      <span className="ml-1">× {item.quantity}</span>
                                    </div>
                                    {appliedRule && (
                                      <div className="text-emerald-600 text-[11px]">
                                        {discountPercent ? `${Math.round(discountPercent)}% off` : 'Discount'}: {appliedRule}
                                        {savings > 0 && <span className="ml-1 font-medium">(save ${fmt(savings)})</span>}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span>
                                    ${fmt(unitPrice)}/ea × {item.quantity}
                                  </span>
                                )}
                              </div>
                              {item.attributes && !isEmpty(item.attributes) && (
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {Object.entries(item.attributes)
                                    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                                    .map(([key, value]) => (
                                      <span key={key} className="mr-2">
                                        <span className="font-medium"><AttributeTitle name={key} />:</span> <AttributeValue name={key} value={value} />
                                      </span>
                                    ))}
                                </div>
                              )}
                              {/* Uploaded artwork / instructions and the design proof */}
                              <LineItemOptions
                                options={item.options?.filter((option) => option.type || !item.attributes || !(option.name in item.attributes))}
                                design={item.design}
                                className="mt-1"
                                compact
                              />
                              <div className="sf-cart-ctl">
                                <div className="sf-cart-qty">
                                  <button
                                    onClick={() => handleQuantityChange(item.cartItemId!, item.quantity - 1)}
                                    aria-label="Decrease quantity"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      handleQuantityChange(item.cartItemId!, Math.max(1, val));
                                    }}
                                    aria-label="Quantity"
                                  />
                                  <button
                                    onClick={() => handleQuantityChange(item.cartItemId!, item.quantity + 1)}
                                    aria-label="Increase quantity"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <button onClick={() => handleRemoveItem(item.cartItemId!)} className="sf-cart-rm">
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Rentals Section */}
                {rentalItems.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Rentals ({rentalItems.length})
                    </h3>
                    <div className="space-y-4">
                      {rentalItems.map((item, index) => {
                        // Get server pricing for this rental item
                        const serverItem = pricing?.rentalItems?.find(
                          (p: any) => p.sku === item.sku && p.startDate === item.startDate && p.endDate === item.endDate,
                        );
                        // Use server data only
                        const fees = serverItem?.fees || [];
                        const deposit = serverItem?.deposit ?? 0;
                        const unitPrice = serverItem?.unitPrice ?? item.unitPrice ?? 0;
                        const amount = serverItem?.amount ?? item.amount ?? unitPrice;
                        const lineTotal = serverItem?.lineTotal ?? item.lineTotal ?? 0;
                        const duration = serverItem?.duration ?? item.duration;
                        const rentalPeriod = serverItem?.rentalPeriod ?? item.rentalPeriod;

                        return (
                          <div
                            key={item.cartItemId || `rental-${item.id}-${item.sku}-${index}`}
                            className="pb-4 border-b border-gray-100 dark:border-gray-800"
                          >
                            <div className="flex items-start gap-4">
                              <div className="relative w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden flex-shrink-0">
                                {item.image && <img src={item.image} alt={item.name} className="w-full h-full object-cover" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</h4>
                                <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDateRange(item.startDate, item.endDate)}
                                </p>
                                {unitPrice && rentalPeriod && duration && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    ${fmt(unitPrice)}/{rentalUnit(rentalPeriod)} × {duration}
                                  </p>
                                )}
                                <div className="mt-2 flex items-center justify-between">
                                  <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md">
                                    <button
                                      onClick={() => handleQuantityChange(item.cartItemId!, item.quantity - 1)}
                                      className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value) || 1;
                                        handleQuantityChange(item.cartItemId!, Math.max(1, val));
                                      }}
                                      className="w-12 h-7 text-center text-sm border-0 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                    <button
                                      onClick={() => handleQuantityChange(item.cartItemId!, item.quantity + 1)}
                                      className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <button onClick={() => handleRemoveItem(item.cartItemId!)} className="text-gray-400 hover:text-red-500">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Display server data only - no calculations */}
                            <div className="mt-3 ml-20 space-y-1 text-xs">
                              <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span className={`transition-opacity ${loading ? 'opacity-40' : ''}`}>{serverItem ? `$${fmt(amount)}` : <Pricing />}</span>
                              </div>
                              {fees.map((fee: any, feeIdx: number) => (
                                <div key={feeIdx} className="flex justify-between text-gray-600">
                                  <span>{fee.name}</span>
                                  <span>${fmt(fee.amount)}</span>
                                </div>
                              ))}
                              {lineTotal && fees.length > 0 && (
                                <div className="flex justify-between font-medium text-gray-900 dark:text-white pt-1 border-t border-gray-100">
                                  <span>Line Total</span>
                                  <span className={`transition-opacity ${loading ? 'opacity-40' : ''}`}>{serverItem ? `$${fmt(lineTotal)}` : <Pricing />}</span>
                                </div>
                              )}
                              {deposit > 0 && (
                                <div className="flex justify-between text-amber-600">
                                  <span>Deposit (refundable)</span>
                                  <span>${fmt(deposit)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {isMounted && hasItems && (
            <div className="sf-cart-ft">
              {productItems.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{rentalItems.length ? 'Products' : 'Subtotal'}</span>
                  <span className={`font-medium transition-opacity ${loading ? 'opacity-40' : ''}`}>{pricing ? `$${fmt(displayProductTotal)}` : <Pricing />}</span>
                </div>
              )}

              {rentalItems.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Rentals</span>
                  <span className={`font-medium transition-opacity ${loading ? 'opacity-40' : ''}`}>{pricing ? `$${fmt(pricing.rentalTotal)}` : <Pricing />}</span>
                </div>
              )}

              {/* Show shipping - with strikethrough if free */}
              {(pricing?.productShipping > 0 || pricing?.freeShipping) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  {pricing?.freeShipping ? (
                    <span className="text-emerald-600 font-medium">
                      {pricing?.productShipping > 0 && <span className="line-through text-gray-400 mr-2">${fmt(pricing.productShipping)}</span>}
                      FREE
                    </span>
                  ) : (
                    <span className="font-medium">${fmt(pricing?.productShipping)}</span>
                  )}
                </div>
              )}

              {/* Display discounts from server */}
              {pricing?.discounts?.map((disc: any, idx: number) => {
                const isWaiverType = ['free_shipping', 'free_deposit', 'free_delivery', 'waive_fees'].includes(disc.type);

                if (isWaiverType) {
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm text-emerald-600">
                      <span className="flex items-center gap-1">
                        <span>✓</span>
                        <span className="capitalize">{disc.name || disc.type.replace(/_/g, ' ')}</span>
                      </span>
                      <span className="font-medium">Applied</span>
                    </div>
                  );
                }

                if (disc.amount > 0) {
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm text-emerald-600">
                      <span>{disc.code ? `Coupon: ${disc.code}` : disc.name}</span>
                      <span className="font-medium">-${fmt(disc.amount)}</span>
                    </div>
                  );
                }

                return null;
              })}

              <div className="sf-cart-total">
                <span className="flex items-center gap-2">
                  Total
                  {(loading || !pricing) && (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-gray-500" role="status">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Updating…
                    </span>
                  )}
                </span>
                <span className={`transition-opacity ${loading ? 'opacity-40' : ''}`}>{pricing ? `$${fmt(displayTotal)}` : <Pricing />}</span>
              </div>

              {pricingError && <p role="alert" className="sf-err">{pricingError}</p>}

              <button
                onClick={handleCheckout}
                disabled={loading || !pricing || !!pricingError}
                className="sf-btn lg block"
              >
                <Lock className="w-4 h-4" />
                Checkout{pricing ? ` · $${fmt(displayTotal)}` : ''}
              </button>
              <div className="sf-cart-fine">
                <span>Shipping and taxes confirmed at checkout</span>
                <button onClick={clearCart} className="sf-cart-rm">Clear bag</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Cart;
