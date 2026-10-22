'use client';

// from base-app/src/components/storefront/CheckoutSuccess.tsx — ported verbatim; only import paths rewired.
import { checkoutPayment, responseErrorCode } from './checkout-payment';

import React, { useEffect, useRef, useState } from 'react';
import { clearGiftCardPins, giftCardsWithPins } from './gift-card/checkout-gift-cards';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCartStore } from '@/modules/store/store/cart-store';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import { Loader2 } from 'lucide-react';
import { toast } from '@/modules/store/shims/sonner';
import { getResponseErrorMessage } from '@/modules/store/lib-client/helpers';
import { activeSession } from '@/modules/store/lib/active-session';

interface CheckoutSuccessProps {
  storePage?: string;
}

export const CheckoutSuccess: React.FC<CheckoutSuccessProps> = ({ storePage }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkoutData: storeCheckoutData, clearCart, getProductItems, getRentalItems, _hasHydrated } = useCartStore();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startedPayments = useRef(new Set<string>());

  // Determine paths based on current route
  const getBasePath = () => {
    if (typeof window === 'undefined') return '';
    const currentPath = window.location.pathname;
    const isPreview = currentPath.includes('/preview/');
    // Check if we're in the direct /checkout route vs /{storePage}/checkout
    const isDirectCheckout = currentPath === '/checkout/success' || currentPath === '/preview/checkout/success';

    if (isDirectCheckout) {
      return isPreview ? '/preview' : '';
    }
    return isPreview ? `/preview/${storePage || 'store'}` : `/${storePage || 'store'}`;
  };

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage before processing
    if (!_hasHydrated) {
      return;
    }
    // Clearing the cart changes this effect's dependencies before navigation
    // finishes. Do not submit again or report the now-empty cart as an error.
    // The same guard also covers React StrictMode's effect replay.
    const attemptKey = `${searchParams.get('payment_intent') || ''}:${searchParams.get('redirect_status') || ''}`;
    if (startedPayments.current.has(attemptKey)) return;
    startedPayments.current.add(attemptKey);
    setError(null);

    const processOrder = async () => {
      try {
        // Extract payment information from URL
        const paymentIntent = searchParams.get('payment_intent');
        const redirectStatus = searchParams.get('redirect_status');

        if (!paymentIntent || redirectStatus !== 'succeeded') {
          setError('Payment verification failed');
          setProcessing(false);
          const basePath = getBasePath();
          const checkoutPath = basePath ? `${basePath}/checkout` : '/checkout';
          setTimeout(() => router.push(checkoutPath), 3000);
          return;
        }

        // Get checkout data from Zustand store (now rehydrated from localStorage)
        // Small delay to ensure localStorage write from checkout page is complete
        await new Promise(resolve => setTimeout(resolve, 200));

        const checkoutData = storeCheckoutData;

        // Get product and rental items separately
        const productItems = getProductItems();
        const rentalItems = getRentalItems();

        if (!checkoutData || (productItems.length === 0 && rentalItems.length === 0)) {
          // Retry once after a short delay - localStorage write might still be in progress
          await new Promise(resolve => setTimeout(resolve, 500));

          // Re-read from store after delay
          const retryCheckoutData = useCartStore.getState().checkoutData;
          const retryProductItems = useCartStore.getState().getProductItems();
          const retryRentalItems = useCartStore.getState().getRentalItems();

          if (!retryCheckoutData || (retryProductItems.length === 0 && retryRentalItems.length === 0)) {
            setError(
              `Checkout data not found. We cannot complete your order. Please contact support with checkout reference: ${paymentIntent}`,
            );
            setProcessing(false);
            return;
          }

          // Use retry data and continue
          return processOrderWithData(retryCheckoutData, retryProductItems, retryRentalItems, paymentIntent);
        }

        await processOrderWithData(checkoutData, productItems, rentalItems, paymentIntent);
      } catch (error) {
        console.error('Error processing order:', error);
        const paymentRef = searchParams.get('payment_intent');
        setError(`Failed to complete order. Please contact support with checkout reference: ${paymentRef}`);
        setProcessing(false);
      }
    };

    const processOrderWithData = async (checkoutData: any, productItems: any[], rentalItems: any[], paymentIntent: string) => {
      try {
        // Customer name for the order - addresses saved server-side may not carry a name,
        // so fall back to the checkout name / the other address's name
        const customerName = (checkoutData.name || checkoutData.shippingAddress?.name || checkoutData.billingAddress?.name || '').trim();

        // Every address on the order must carry the customer name and a phone
        const withCustomer = (address: any) =>
          address
            ? {
                ...address,
                name: (address.name || customerName || '').trim(),
                phone: address.phone || checkoutData.phone,
              }
            : undefined;

        // Prepare order data with separate product and rental items
        const orderData = {
          productItems: productItems.map((item) => ({
            sku: item.sku,
            name: item.name,
            price: item.price,
            unitPrice: item.price,
            quantity: item.quantity,
            // Server figure only. `price * quantity` here would send the
            // server a line amount this client invented, and it is the amount
            // the customer is charged.
            amount: item.amount,
            image: item.image,
            attributes: item.attributes,
            // The shopper chose to pay this line with reward points; the server prices it and spends the points.
            ...(item.payWithPoints ? { payWithPoints: true } : {}),
            // Chosen attribute values - uploaded artwork/instructions ride in
            // options[].files, and the server copies both onto the order line
            options: item.options,
            design: item.design,
          })),
          rentalItems: rentalItems.map((item) => ({
            sku: item.sku,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? item.price,
            amount: item.amount ?? item.price,
            lineTotal: item.lineTotal,
            deposit: item.deposit ?? 0,
            image: item.image,
            attributes: item.attributes,
            startDate: item.startDate,
            endDate: item.endDate,
            rentalPeriod: item.rentalPeriod,
            duration: item.duration,
            fees: item.fees || [],
            selectedFees: item.selectedFees || [],
            // The rental agreement the customer accepted on the item page
            ...(item.agreement ? { agreement: item.agreement } : {}),
            // Fulfillment from checkout data - already using SDK AddressSchema (name, street1, street2, city, state, zip, country, phone)
            fulfillment: checkoutData.rentalFulfillment?.fulfillment
              ? {
                  type: checkoutData.rentalFulfillment.fulfillment.type,
                  address: withCustomer(checkoutData.rentalFulfillment.fulfillment.address),
                  instructions: checkoutData.rentalFulfillment.fulfillment.instructions,
                }
              : undefined,
            return: checkoutData.rentalFulfillment?.return
              ? {
                  type: checkoutData.rentalFulfillment.return.type,
                  address: withCustomer(checkoutData.rentalFulfillment.return.address),
                  instructions: checkoutData.rentalFulfillment.return.instructions,
                }
              : undefined,
          })),
          // Totals from checkout data
          subtotal: checkoutData.subtotal,
          tax: checkoutData.tax,
          discount: checkoutData.discount,
          total: checkoutData.total,
          // For rental-only carts, shippingAddress might be empty - use billingAddress as fallback
          // Already using SDK AddressSchema: name, street1, street2, city, state, zip, country, phone
          shippingAddress: checkoutData.shippingAddress?.street1
            ? withCustomer(checkoutData.shippingAddress)
            : withCustomer(checkoutData.billingAddress),
          billingAddress: checkoutData.billingAddress
            ? withCustomer(checkoutData.billingAddress)
            : checkoutData.shippingAddress?.street1
              ? withCustomer(checkoutData.shippingAddress)
              : undefined,
          // Paid entirely by gift cards and/or store credit / points: there is no gateway payment
          // to point at — the server spends the cards and the wallet below and records each one.
          ...checkoutPayment(checkoutData, paymentIntent),
          giftCards: giftCardsWithPins(checkoutData.giftCards),
          // Store credit / points the shopper chose; the server spends them after the gift cards, for what those left.
          ...(checkoutData.wallet && (checkoutData.wallet.storeCredit !== undefined || checkoutData.wallet.points !== undefined)
            ? { wallet: checkoutData.wallet }
            : {}),
          currency: checkoutData.currency,
          // returns course, 11 Oct: the checkout's prefill can lose the race with its reset, leaving the email blank;
          // a signed-in shopper's order then had no email and could never be looked up again. Fall back to the session.
          email: checkoutData.email || (activeSession.getUser() as any)?.data?.email || (activeSession.getUser() as any)?.email,
          name: customerName,
          shippingMethod: 'standard',
          shippingFee: checkoutData.shipping,
          discounts: checkoutData.discount > 0 ? [{ code: checkoutData.discountCode, amount: checkoutData.discount }] : [],
          cartId: checkoutData.cartId,

        };

        // Submit order to server
        const order = await storefrontAPI.submitCheckoutOrder(orderData);

        if (order) {
          // Clear cart (this will also clear checkout data via the store)
          clearCart();
          clearGiftCardPins();

          // Redirect to order confirmation
          const basePath = getBasePath();
          const orderPath = basePath
            ? `${basePath}/order/${order.email}/${order.number}`
            : `/order/${order.email}/${order.number}`;
          router.replace(orderPath);
        } else {
          throw new Error('Failed to create order');
        }
      } catch (error) {
        console.error('Error processing order:', error);
        const paymentRef = searchParams.get('payment_intent');
        // A checkout the shop refused because the cart changed says so (and whether the
        // card payment went back); anything else keeps the support reference.
        const refused = getResponseErrorMessage(error, '');
        // Too few reward points for the lines set to points: refused before anything was charged — the server's sentence.
        setError(responseErrorCode(error) === 'NOT_ENOUGH_POINTS' && refused
          ? `${refused} Nothing was charged and your cart is kept: open checkout again and switch a line to paying with money.`
          : /cart changed during checkout/i.test(refused)
          ? `${refused} Reference: ${paymentRef}`
          : `Failed to complete order. Please contact support with checkout reference: ${paymentRef}`);
        setProcessing(false);
      }
    };

    processOrder();
  }, [_hasHydrated, searchParams, storeCheckoutData, router, clearCart, getProductItems, getRentalItems]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Order Processing Error</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => {
              const basePath = getBasePath();
              router.push(basePath || '/');
            }}
            className="px-6 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Return to Store
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-slate-900 mx-auto mb-4" />
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Processing your order...</h1>
        <p className="text-slate-600">Please wait while we complete your purchase.</p>
      </div>
    </div>
  );
};
