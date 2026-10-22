// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
'use client';

// from base-app/src/components/storefront/Checkout.tsx — ported verbatim; only import paths rewired.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore, AppliedPromotion } from '@/modules/store/store/cart-store';
import { storefrontAPI } from '@/modules/store/lib/storefront-api';
import { rentalAPI } from '@/modules/store/lib/rental-api';
import { activeSession } from '@/modules/store/lib/active-session';
import { getResponseErrorMessage } from '@/modules/store/lib-client/helpers';
import { toast } from '@/modules/store/shims/sonner';
import { ArrowLeft, ShoppingCart, Building2 } from 'lucide-react';
import { CustomerInfo } from './CustomerInfo';
import { CheckoutCart } from './CheckoutCart';
import { PaymentGateways } from './PaymentGateways';
import { RentalFulfillment, RentalFulfillmentData } from './RentalFulfillment';
import { PaymentAmount, CustomerInfo as PaymentCustomerInfo, PaymentResult } from '@/modules/store/components/payment-gateways/types';
import { checkoutCartRecord, checkoutQuoteReady, selectCheckoutCoupon } from './checkout-quote';
import { CheckoutGiftCards } from './gift-card/CheckoutGiftCards';
import { GIFT_CARDS_ONLY, giftCardsWithPins } from './gift-card/checkout-gift-cards';
import { CheckoutStoreCredit } from './store-credit/CheckoutStoreCredit';
import { findPricedProductLine } from './utils/cart-line-pricing';
import type { CheckoutWalletChoice } from '@/modules/store/store/cart-store';

interface PaymentGateway {
  name: string;
  displayName?: string;
  description?: string;
}

interface PickupLocation {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  hours?: string;
  phone?: string;
}

interface CheckoutProps {
  paymentGateways: PaymentGateway[];
  storePage?: string;
  pickupLocation?: PickupLocation;
  userData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    name?: string;
  } | null;
}

// Server cart summary - single source of truth for all pricing (matches SDK sf-cart schema)
interface CartSummary {
  // Cart ID from server
  cartId?: string;
  // Rental totals
  rentalSubtotal?: number;
  rentalDeposit?: number;
  rentalDiscount?: number;
  rentalTax?: number;
  rentalDeliveryFee?: number;
  rentalTotal?: number;
  rentalCount?: number;
  // Product totals
  productSubtotal?: number;
  productDiscount?: number;
  productTax?: number;
  productShipping?: number;
  productTotal?: number;
  productCount?: number;
  // Combined totals (rental + product)
  subtotal: number;
  discount: number;
  tax: number;
  total: number; // Grand total (rentalTotal + productTotal + rentalDeposit)
  // Legacy/fallback fields
  shipping?: number;
  deposit?: number;
  // Discounts
  discounts: Array<{
    code?: string;
    name: string;
    amount: number;
    type: string;
    message?: string;
    /** A promotion that gives points or store credit (amount 0): what the shopper gets, in the server's words. */
    note?: string;
  }>;
  // Item details
  items?: Array<{
    sku: string;
    originalPrice: number;
    finalPrice: number;
    discount: number;
  }>;
  productItems?: Array<any>;
  rentalItems?: Array<any>;
}

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

export const Checkout: React.FC<CheckoutProps> = ({ paymentGateways, storePage = 'store', pickupLocation, userData }) => {
  // The shared account the shopper is buying for, if any (chosen on the account page; carried by the session).
  const [orderingFor, setOrderingFor] = useState('');
  useEffect(() => {
    const u: any = activeSession.getUser();
    const id = u?.data?.sharedAccountId;
    if (id) setOrderingFor((u?.data?.sharedAccounts || []).find((a: any) => a?.id === id)?.name || 'a shared account');
  }, []);
  const router = useRouter();
  const {
    items,
    setCheckoutData,
    checkoutData,
    _hasHydrated,
    removePromotion,
    setAvailablePromotions,
    couponCode: storeCouponCode,
    setCouponCode: setStoreCouponCode,
    couponError,
    setCouponError,
    customerBenefits,
    setCustomerBenefits,
    getProductItems,
    getRentalItems,
    setLinePayWithPoints,
  } = useCartStore();

  // Get product and rental items from unified store
  const productItems = getProductItems();
  const rentalItems = getRentalItems();

  const hasRentalItems = rentalItems.length > 0;
  const hasProductItems = productItems.length > 0;
  const isRentalOnly = hasRentalItems && !hasProductItems;

  const [couponCode, setCouponCode] = useState(checkoutData?.discountCode || storeCouponCode || '');
  const [couponLoading, setCouponLoading] = useState(false);
  const [editingSection, setEditingSection] = useState<'contact' | 'shipping' | 'rental' | 'payment' | null>(null);
  const [completedSections, setCompletedSections] = useState<Set<string>>(() => {
    const sections = new Set<string>();
    // Only mark contact as completed if email is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (checkoutData?.email && emailRegex.test(checkoutData.email)) {
      sections.add('contact');
    }
    // Only mark shipping as completed if ALL required fields are filled (SDK AddressSchema)
    const addr = checkoutData?.shippingAddress;
    if (addr?.name && addr?.street1 && addr?.city && addr?.state && addr?.zip) {
      sections.add('shipping');
    }
    return sections;
  });
  const [selectedPaymentGateway] = useState(checkoutData?.paymentGateway || 'stripe');

  // Rental fulfillment state - default to pickup/dropoff (no address needed)
  const [rentalFulfillment, setRentalFulfillment] = useState<RentalFulfillmentData>({
    fulfillment: { type: 'pickup' },
    return: { type: 'dropoff' },
  });

  // For rental-only carts, address is only needed if delivery or return pickup is selected
  const needsAddressForRental = rentalFulfillment.fulfillment.type === 'delivery' || rentalFulfillment.return.type === 'pickup';

  // Track if user data has been loaded (or attempted)
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  // Set initial editing section based on what's already completed
  // Wait for user data to load first (if user is signed in)
  const [initialSectionSet, setInitialSectionSet] = useState(false);
  useEffect(() => {
    if (!_hasHydrated || items.length === 0) return;
    // Wait for user data loading to complete before setting initial section
    if (!userDataLoaded) return;
    if (initialSectionSet) return;

    // Determine which section should be active based on completed sections
    if (!completedSections.has('contact')) {
      setEditingSection('contact');
    } else if (isRentalOnly) {
      // For rental-only: Contact → Rental → Billing → Payment
      if (!completedSections.has('rental')) {
        setEditingSection('rental');
      } else if (!completedSections.has('shipping')) {
        // Billing address is always required for payment
        setEditingSection('shipping');
      } else {
        setEditingSection('payment');
      }
    } else {
      // For product carts: Contact → Shipping → Rental → Payment
      if (!completedSections.has('shipping')) {
        setEditingSection('shipping');
      } else if (hasRentalItems && !completedSections.has('rental')) {
        setEditingSection('rental');
      } else {
        setEditingSection('payment');
      }
    }
    setInitialSectionSet(true);
  }, [_hasHydrated, items.length, hasRentalItems, isRentalOnly, needsAddressForRental, initialSectionSet, completedSections, userDataLoaded]);

  // Cart summary from server - single source of truth
  const [cartSummary, setCartSummary] = useState<CartSummary | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [quotedRequestKey, setQuotedRequestKey] = useState<string | null>(null);
  const quoteGeneration = useRef(0);

  // Gift cards applied here. The summary reports what they cover; the order spends them.
  const giftCodes: string[] = checkoutData?.giftCards || [];
  // Bumped when the same cards are asked about again (a PIN was just entered).
  const [giftAsk, setGiftAsk] = useState(0);
  const giftKey = `${giftCodes.join(',')}#${giftAsk}`;
  // Store credit / points the signed-in shopper chose to use. Saved with the checkout like the gift cards, so a
  // card payment that bounces through the bank comes back to the same choice; the server says what it covers.
  const walletChoice: CheckoutWalletChoice | undefined = checkoutData?.wallet;
  const walletChosen = walletChoice?.storeCredit !== undefined || walletChoice?.points !== undefined;
  const walletKey = walletChosen ? JSON.stringify(walletChoice) : '';

  const quoteRequestKey = JSON.stringify({
    productItems, rentalItems, coupon: storeCouponCode, email: checkoutData?.email,
    phone: checkoutData?.phone, shippingAddress: checkoutData?.shippingAddress,
    billingAddress: checkoutData?.billingAddress, giftKey, walletKey,
    rentalFulfillment: hasRentalItems ? rentalFulfillment : undefined,
  });
  const shippingAddressComplete = ['name', 'street1', 'city', 'state', 'zip', 'country']
    .every(field => String(checkoutData?.shippingAddress?.[field] || '').trim());
  const quoteReady = checkoutQuoteReady({ summary: cartSummary, loading: cartLoading,
    error: cartError, quotedKey: quotedRequestKey, currentKey: quoteRequestKey })
    && (!hasProductItems || shippingAddressComplete);
  // A re-quote after a change on the payment step (a gift card applied or removed, a PIN entered) keeps the
  // current totals and payment section on screen, marked busy, and swaps them when the answer comes. Before,
  // the section unmounted for the round trip: totals blanked to "—" and the page jumped to the top and back.
  // Nothing can be paid while it refreshes (the section ignores input), and a new amount remounts the form.
  const quoteRefreshing = !quoteReady && cartLoading && !cartError && !!cartSummary && quotedRequestKey !== null
    && (!hasProductItems || shippingAddressComplete);

  // Fetch complete cart summary from server - single source of truth
  const fetchCartSummary = useCallback(async () => {
    // If only rental items, set empty cart summary (rental pricing handled separately)
    if (items.length === 0) {
      setCartSummary({ subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0, discounts: [] });
      return;
    }

    const generation = ++quoteGeneration.current;
    setCartLoading(true);
    setCartError(null);
    // A half-typed address is not sent for a delivery quote: the carrier can only refuse it, and the
    // shopper saw a red "Delivery quote unavailable" while still typing (bm-retail-trading, 12 Oct).
    // Until the address is complete the summary is priced without shipping, as on first load.
    const quoteAddress = hasProductItems && !shippingAddressComplete ? undefined : checkoutData?.shippingAddress;
    try {
      // Send cart with separated items per SDK schema
      const result = await storefrontAPI.calculateCartSummary({
        productItems,
        rentalItems,
        cartId: cartSummary?.cartId || checkoutData?.cartId,
        couponCode: storeCouponCode || undefined,
        email: checkoutData?.email,
        phone: checkoutData?.phone,
        shippingAddress: quoteAddress,
        billingAddress: checkoutData?.billingAddress,
        // Include rental fulfillment options
        rentalFulfillment: hasRentalItems ? rentalFulfillment : undefined,
        giftCards: giftCardsWithPins(giftCodes),
        wallet: walletChosen ? walletChoice : undefined,
      });

      if (generation !== quoteGeneration.current) return;
      // Store the cart this quote is for before anything may be paid against it: the
      // order is built from the stored cart, and the card amount is checked against it.
      await storefrontAPI.persistPricedCart(checkoutCartRecord(result, {
        couponCode: storeCouponCode,
        // The same rule as the quote: a half-typed address is not stored on the priced cart (its save re-quotes it).
        shippingAddress: quoteAddress,
        email: checkoutData?.email,
      }) as any);
      if (generation !== quoteGeneration.current) return;
      console.log('[Checkout] Server cart summary:', result);
      setCartSummary(result);
      setQuotedRequestKey(quoteRequestKey);
      setCouponError(storeCouponCode && result.valid === false
        ? (result.message || result.reason || 'This coupon is no longer available')
        : null);
    } catch (error) {
      if (generation !== quoteGeneration.current) return;
      console.error('[Checkout] Failed to fetch cart summary:', error);
      setCartSummary(null);
      setQuotedRequestKey(null);
      setCartError(getResponseErrorMessage(error, 'We could not quote this order. Check your delivery address or contact the shop.'));
    } finally {
      if (generation === quoteGeneration.current) setCartLoading(false);
    }
  }, [
    items,
    storeCouponCode,
    checkoutData?.email,
    checkoutData?.phone,
    checkoutData?.shippingAddress,
    checkoutData?.billingAddress,
    hasRentalItems,
    rentalFulfillment,
    giftKey,
    walletKey,
    quoteRequestKey,
  ]);

  // Fetch cart summary when items, coupon, or address changes
  const itemsKey = items.map((i) => `${i.sku}:${i.quantity}`).join(',');
  const addressKey = checkoutData?.shippingAddress
    ? `${checkoutData.shippingAddress.city}-${checkoutData.shippingAddress.state}-${checkoutData.shippingAddress.zip}`
    : '';
  useEffect(() => {
    if (_hasHydrated && items.length > 0) {
      // Wait until the shopper stops typing: fetchCartSummary changes with every keystroke in the
      // contact and address fields, and each quote asks the carrier for live rates. Quoting per
      // keystroke got the store's carrier account rate-limited mid-checkout ("Delivery quote unavailable").
      const t = setTimeout(() => {
        console.log('[Checkout] Fetching cart summary...', { itemsKey, storeCouponCode, addressKey });
        fetchCartSummary();
      }, 700);
      return () => clearTimeout(t);
    }
  }, [_hasHydrated, itemsKey, storeCouponCode, addressKey, giftKey, walletKey, fetchCartSummary]);

  // DIRECT FROM SERVER - No client-side calculations (matches SDK sf-cart schema)
  // Rental totals
  const rentalSubtotal = cartSummary?.rentalSubtotal ?? 0;
  const rentalDeposit = cartSummary?.rentalDeposit ?? cartSummary?.deposit ?? 0;
  const rentalTax = cartSummary?.rentalTax ?? 0;
  const rentalDeliveryFee = cartSummary?.rentalDeliveryFee ?? 0;
  const rentalTotal = cartSummary?.rentalTotal ?? 0;
  // Product totals
  const productSubtotal = cartSummary?.productSubtotal ?? 0;
  const productTax = cartSummary?.productTax ?? 0;
  const productShipping = cartSummary?.productShipping ?? cartSummary?.shipping ?? 0;
  const productTotal = cartSummary?.productTotal ?? 0;
  // Combined totals
  const subtotal = cartSummary?.subtotal ?? 0;
  const discount = cartSummary?.discount ?? 0;
  const tax = cartSummary?.tax ?? 0;
  const total = cartSummary?.total ?? 0; // Includes deposit
  const shippingBlocked: string | undefined = (cartSummary as any)?.shippingBlocked || undefined;

  // Shipping is calculated by server in cart summary - no client-side calculation needed

  // Keep the shopper's code across reloads. fetchCartSummary revalidates it
  // on the server; deleting it on mount silently removed valid discounts.
  useEffect(() => {
    if (_hasHydrated) setCouponCode(storeCouponCode || '');
  }, [_hasHydrated, storeCouponCode]);

  // Fetch promotions and customer benefits on mount
  useEffect(() => {
    const fetchPromotionsAndBenefits = async () => {
      try {
        // Fetch available promotions
        const promoResult = await storefrontAPI.getPromotions();
        if (promoResult?.promotions) {
          const autoApplyPromos = promoResult.promotions
            .filter((p) => p.autoApply)
            .map((p) => ({
              name: p.name,
              type: p.type,
              value: p.value || 0,
              appliedAmount: 0, // Will be calculated
              autoApplied: true,
            }));
          setAvailablePromotions(autoApplyPromos as AppliedPromotion[]);
        }

        // Get customer benefits from session (already loaded on login)
        const customer = storefrontAPI.getCustomerFromSession();
        if (customer?.benefits) {
          setCustomerBenefits({
            groups: customer.customerGroups || [],
            discountPercent: customer.benefits.discountPercent || 0,
            freeShipping: customer.benefits.freeShipping || false,
            freeShippingMinimum: customer.benefits.freeShippingMinimum,
            earlyAccess: customer.benefits.earlyAccess || false,
            prioritySupport: customer.benefits.prioritySupport || false,
            bonusPointsMultiplier: customer.benefits.bonusPointsMultiplier || 1,
            tierName: customer.tier,
          });
        }
      } catch (error) {
        console.error('Failed to fetch promotions/benefits:', error);
      }
    };

    if (_hasHydrated) {
      fetchPromotionsAndBenefits();
    }
  }, [_hasHydrated, setAvailablePromotions, setCustomerBenefits]);

  // Auto-fill user info and address if signed in
  useEffect(() => {
    const loadUserDataAndAddresses = async () => {
      // Try server-side userData prop first, then fall back to client-side session
      let userFromSession = userData;
      if (!userFromSession?.email) {
        // Try client-side session (cookies) - email is in data.email
        const sessionUser = activeSession.getUser();
        if (sessionUser?.data?.email || sessionUser?.email) {
          userFromSession = {
            email: sessionUser.data?.email || sessionUser.email || sessionUser.name,
            firstName: sessionUser.data?.firstName || sessionUser.firstName || '',
            lastName: sessionUser.data?.lastName || sessionUser.lastName || '',
            phone: sessionUser.data?.phone || sessionUser.phone || '',
            name: sessionUser.data?.firstName ? `${sessionUser.data.firstName} ${sessionUser.data.lastName || ''}`.trim() : sessionUser.name,
          };
        }
      }

      const userEmail = userFromSession?.email;

      if (!userEmail) {
        // Not signed in, mark as loaded so initial section can be set
        setUserDataLoaded(true);
        return;
      }

      console.log('SIGNED IN as:', userEmail);

      // Don't overwrite if user already has data filled in
      if (checkoutData?.email && checkoutData?.shippingAddress?.street1) {
        setUserDataLoaded(true);
        return;
      }

      try {
        // Get addresses from API for pre-filling
        const addresses = await storefrontAPI.getCustomerAddresses();

        const updates: Partial<any> = {};

        // Pre-fill contact info from user data (server-side or client-side session)
        if (!checkoutData?.email && userFromSession) {
          updates.email = userFromSession.email;
        }

        // Get name from user data
        const firstName = userFromSession?.firstName || '';
        const lastName = userFromSession?.lastName || '';
        const fullName = userFromSession?.name || `${firstName} ${lastName}`.trim();

        if (!checkoutData?.name && fullName) {
          updates.name = fullName;
        }
        if (!checkoutData?.phone && userFromSession?.phone) {
          updates.phone = userFromSession.phone;
        }

        // Find default address or first available address
        const defaultAddress = addresses?.find((a) => a.isDefault) || addresses?.[0];

        if (defaultAddress && !checkoutData?.shippingAddress?.street1) {
          // Get name - SDK uses 'name' field, or build from user session
          const addressName = defaultAddress.name || `${userFromSession?.firstName || ''} ${userFromSession?.lastName || ''}`.trim() || userFromSession?.name || '';

          // Pre-fill shipping address using SDK AddressSchema
          updates.shippingAddress = {
            name: addressName,
            street1: defaultAddress.street1 || '',
            street2: defaultAddress.street2 || '',
            city: defaultAddress.city || '',
            state: defaultAddress.state || '',
            zip: defaultAddress.zip || '',
            country: defaultAddress.country || 'US',
            phone: defaultAddress.phone || userFromSession?.phone || '',
          };

          // Also pre-fill checkout name
          if (!updates.name && addressName) {
            updates.name = addressName;
          }

          // Pre-fill phone if available from address
          if (!updates.phone && defaultAddress.phone) {
            updates.phone = defaultAddress.phone;
          }

          // For billing, use same address if type is 'both' or 'billing'
          if (defaultAddress.type === 'both' || defaultAddress.type === 'billing') {
            updates.billingAddress = {
              name: addressName,
              street1: defaultAddress.street1 || '',
              street2: defaultAddress.street2 || '',
              city: defaultAddress.city || '',
              state: defaultAddress.state || '',
              zip: defaultAddress.zip || '',
              country: defaultAddress.country || 'US',
              phone: defaultAddress.phone || userFromSession?.phone || '',
            };
          }

          // Mark contact and shipping as complete if we have all required data
          if (updates.email) {
            setCompletedSections((prev) => new Set([...prev, 'contact']));
          }
          if (
            updates.shippingAddress?.name &&
            updates.shippingAddress?.street1 &&
            updates.shippingAddress?.city &&
            updates.shippingAddress?.state &&
            updates.shippingAddress?.zip
          ) {
            setCompletedSections((prev) => new Set([...prev, 'shipping']));
          }
        } else if (updates.email) {
          // Even without address, mark contact as complete if we have email
          setCompletedSections((prev) => new Set([...prev, 'contact']));
        }

        // Apply updates if we have any
        if (Object.keys(updates).length > 0) {
          const current = useCartStore.getState().checkoutData || checkoutData || {
            email: '',
            name: '',
            phone: '',
            shippingAddress: { name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'US' },
            billingAddress: undefined,
            subtotal: 0,
            shipping: 0,
            tax: 0,
            discount: 0,
            total: 0,
            paymentGateway: 'stripe',
            currency: 'USD',
          };
          setCheckoutData({ ...current, ...updates });
        }
      } catch (error) {
        console.error('Failed to load user data:', error);
      } finally {
        // Always mark as loaded so initial section can be set
        setUserDataLoaded(true);
      }
    };

    if (_hasHydrated) {
      loadUserDataAndAddresses();
    }
    // Only run once on mount after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated]);

  // Helper to update checkout data fields
  const updateField = (updates: Partial<any>) => {
    // Merge into the store's latest copy, not this render's: the pricing effect below ran with a stale closure
    // and wrote back an empty email over the signed-in prefill (returns course, 11 Oct: an order with no email).
    const current = useCartStore.getState().checkoutData || checkoutData || {
      email: '',
      name: '',
      phone: '',
      shippingAddress: { name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'US' },
      billingAddress: undefined,
      subtotal: 0,
      shipping: 0,
      tax: 0,
      discount: 0,
      total: 0,
      paymentGateway: 'stripe',
      currency: 'USD',
    };
    setCheckoutData({ ...current, ...updates });
  };

  // The order is submitted from these saved totals after payment. Keep them the
  // server's current numbers — the card form is open without the shipping
  // section's Continue, so saving them only there sent 0s: free shipping and
  // dropped coupons on the order the server wrote.
  useEffect(() => {
    if (!checkoutData || !cartSummary) return;
    const pricing = { subtotal, shipping: productShipping, tax, discount, total, cartId: cartSummary.cartId };
    if ((Object.keys(pricing) as (keyof typeof pricing)[]).every((k) => (checkoutData as any)[k] === pricing[k])) return;
    updateField(pricing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSummary, !!checkoutData]);

  // Redirect if cart is empty (only after hydration)
  useEffect(() => {
    if (_hasHydrated && items.length === 0) {
      const currentPath = window.location.pathname;
      if (currentPath.includes('/preview/')) {
        router.push(`/preview/${storePage}`);
      } else {
        router.push(`/${storePage}`);
      }
    }
  }, [_hasHydrated, items, router, storePage]);

  // Delivery-address check with the carrier (POST shipping/verify-address). Soft: the
  // shopper always decides — a suggestion or a "can't deliver" answer is shown, and they
  // may keep what they typed. Only an address the carrier couldn't check goes straight on.
  const [addressCheck, setAddressCheck] = useState<null | {
    status: 'corrected' | 'undeliverable';
    message: string;
    suggestedAddress?: any;
    corrections?: Array<{ field: string; from: string; to: string }>;
  }>(null);
  const [addressChecking, setAddressChecking] = useState(false);
  const addressAccepted = useRef<string | null>(null);
  const shippingAddressKey = JSON.stringify(checkoutData?.shippingAddress || {});

  const completeSection = async (section: string) => {
    if (section === 'shipping' && !quoteReady) {
      toast.error(cartError || 'Please wait for the current order quote before continuing.');
      return;
    }
    if (section === 'shipping' && hasProductItems && addressAccepted.current !== shippingAddressKey) {
      setAddressChecking(true);
      try {
        const r: any = await storefrontAPI.verifyAddress(checkoutData!.shippingAddress as any);
        if (r?.status === 'corrected' || r?.status === 'undeliverable') {
          setAddressCheck({ status: r.status, message: r.message, suggestedAddress: r.suggestedAddress, corrections: r.corrections });
          return;
        }
      } catch {
        // Not checkable right now: carry on exactly as before.
      } finally {
        setAddressChecking(false);
      }
      addressAccepted.current = shippingAddressKey;
    }
    setAddressCheck(null);
    advanceSection(section);
  };

  const keepTypedAddress = () => {
    addressAccepted.current = shippingAddressKey;
    setAddressCheck(null);
    advanceSection('shipping');
  };

  const applySuggestedAddress = () => {
    const s = addressCheck?.suggestedAddress;
    if (!s || !checkoutData) return;
    const next = { ...checkoutData.shippingAddress, street1: s.street1, street2: s.street2 || '', city: s.city, state: s.state, zip: s.zip, country: s.country || checkoutData.shippingAddress?.country || 'US' };
    addressAccepted.current = JSON.stringify(next);
    setCheckoutData({ ...checkoutData, shippingAddress: next });
    setAddressCheck(null);
    toast.success('Address updated. Press Continue once the delivery quote has refreshed.');
  };

  const advanceSection = (section: string) => {
    setCompletedSections((prev) => new Set([...prev, section]));

    // Determine next section based on current section and cart contents
    if (section === 'contact') {
      // For rental-only carts, go to rental fulfillment first
      if (isRentalOnly) {
        setEditingSection('rental');
      } else {
        setEditingSection('shipping');
      }
    } else if (section === 'shipping') {
      // Add pricing data when completing shipping section
      if (checkoutData) {
        updateField({
          subtotal,
          shipping: productShipping,
          tax,
          discount,
          discountCode: couponCode,
          total,
          paymentGateway: selectedPaymentGateway,
          cartId: cartSummary?.cartId,
        });
      }
      // For rental-only, shipping comes after rental, so go to payment
      if (isRentalOnly) {
        setEditingSection('payment');
      } else if (hasRentalItems) {
        // For mixed carts, go to rental fulfillment
        setEditingSection('rental');
      } else {
        setEditingSection('payment');
      }
    } else if (section === 'rental') {
      // Save rental fulfillment to checkout data (including addresses if delivery/return pickup)
      if (checkoutData) {
        updateField({
          rentalFulfillment: {
            fulfillment: {
              type: rentalFulfillment.fulfillment.type,
              address: rentalFulfillment.fulfillment.type === 'delivery' ? rentalFulfillment.fulfillment.address : undefined,
              instructions: rentalFulfillment.fulfillment.instructions,
            },
            return: {
              type: rentalFulfillment.return.type,
              address: rentalFulfillment.return.type === 'pickup' ? rentalFulfillment.return.address : undefined,
              instructions: rentalFulfillment.return.instructions,
            },
          },
        });
      }
      // After rental fulfillment, go to billing address (for payment)
      if (isRentalOnly && !completedSections.has('shipping')) {
        // For rental-only, always need billing address for payment
        setEditingSection('shipping');
      } else {
        setEditingSection('payment');
      }
    } else {
      setEditingSection(null);
    }
  };

  const editSection = (section: 'contact' | 'shipping' | 'rental' | 'payment') => {
    setEditingSection(section);
    setCompletedSections((prev) => {
      const newSet = new Set(prev);
      newSet.delete(section);
      return newSet;
    });
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    setCouponLoading(true);
    setCouponError(null);

    try {
      // Validate the coupon with full cart context and user info
      const userInfo = {
        email: checkoutData?.email,
        phone: checkoutData?.phone,
      };
      const validation = await storefrontAPI.validateCoupon(
        couponCode,
        subtotal,
        { productItems, rentalItems, cartId: cartSummary?.cartId || checkoutData?.cartId },
        userInfo,
      );

      if (!validation.valid) {
        setCouponError(validation.message || validation.error || 'Invalid coupon code');
        toast.error(validation.message || validation.error || 'Invalid coupon code');
        return;
      }

      // Apply the coupon and get cart summary with discount
      const result = await selectCheckoutCoupon({
        code: couponCode,
        select: code => { setStoreCouponCode(code); updateField({ discountCode: code }); },
        request: () => storefrontAPI.applyCartCoupon({
        productItems,
        rentalItems,
        cartId: cartSummary?.cartId || checkoutData?.cartId,
        couponCode: couponCode,
        email: checkoutData?.email,
        phone: checkoutData?.phone,
        }),
      });
      console.log('[Checkout] Apply coupon result:', result);

      if (!result.valid) {
        // The server's sentence ("This code can't be combined with …"), not its reason key.
        setCouponError(result.message || result.reason || 'Failed to apply coupon');
        toast.error(result.message || result.reason || 'Failed to apply coupon');
        return;
      }

      // Selection triggers the guarded, destination-aware fetchCartSummary.
      // A late coupon response must never publish its address-less price result.

      if (result.discount > 0) {
        toast.success(`Coupon "${couponCode}" applied! You save $${(result.discount ?? 0).toFixed(2)}`);
      } else {
        toast.success(`Coupon "${couponCode}" applied!`);
      }
    } catch (error: any) {
      const errorMsg = getResponseErrorMessage(error, 'Failed to apply coupon');
      setCouponError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemovePromotion = (name: string) => {
    // Find if this is a coupon-based discount
    const serverDiscount = cartSummary?.discounts?.find((d) => d.name === name || d.code === name);
    if (serverDiscount?.code) {
      // Clear the coupon - this will trigger cart summary refresh
      setCouponCode('');
      setStoreCouponCode('');
      updateField({ discountCode: undefined });
    }
    removePromotion(name);
  };

  // Convert server discounts to appliedPromotions format for display
  const serverDiscountsAsPromotions: AppliedPromotion[] = (cartSummary?.discounts || []).map((d) => ({
    name: d.name,
    code: d.code,
    type: d.type as any,
    value: 0,
    appliedAmount: d.amount,
    autoApplied: !d.code,
    message: d.message,
    note: d.note,
  }));

  // Debug: log discounts
  console.log('[Checkout] cartSummary:', cartSummary);
  console.log('[Checkout] serverDiscountsAsPromotions:', serverDiscountsAsPromotions);

  const handlePaymentSuccess = async (result: PaymentResult) => {
    if (!quoteReady) {
      toast.error(cartError || 'The order quote changed. Review your delivery details before continuing.');
      return;
    }
    // Save payment intent ID to checkout data (rentalFulfillment already saved in completeSection)
    if (checkoutData) {
      updateField({
        paymentIntentId: result.payment_intent_id,
        // The success page records the payment under this name and the server
        // verifies the reference with that gateway. A gift card reference sent
        // to Stripe is a payment nobody can confirm.
        paymentGateway: String(result.metadata?.gateway || checkoutData.paymentGateway || 'stripe'),
      });
    }

    // Rental bookings are made by the server with the order (checkout-cart creates one rental per
    // rental line, after it has checked the payment). Booking them here as well sent a second,
    // malformed request per rental and showed the customer a "Failed to create rental" error.

    // Don't clear cart here - CheckoutSuccess will clear it after order creation
    // This ensures the items and checkoutData are available when the success page loads

    // Wait a moment for Zustand persist to write to localStorage before redirecting
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Redirect to success page
    const currentPath = window.location.pathname;
    if (currentPath.includes('/preview/')) {
      window.location.href = `/preview/checkout/success?payment_intent=${result.payment_intent_id}&redirect_status=succeeded`;
    } else {
      // Appmint One: the checkout lives under the store page (/{storePage}/checkout), as base-app's StorefrontRoute serves it.
      window.location.href = `/${storePage}/checkout/success?payment_intent=${result.payment_intent_id}&redirect_status=succeeded`;
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(`Payment failed: ${error}`);
  };

  // Show nothing until hydration is complete
  if (!_hasHydrated) return null;

  // After hydration, if both carts are empty, return null (useEffect will redirect)
  if (items.length === 0 && rentalItems.length === 0) return null;

  // Prepare payment gateway data for advanced payments
  // With gift cards or store credit / points applied the gateway charges only
  // what they leave — the server's `amountDue`, not a sum made here.
  const summaryAny: any = cartSummary;
  const giftCardTotal: number = summaryAny?.giftCardTotal || 0;
  const walletTotal: number = summaryAny?.walletTotal || 0;
  const walletSummary = summaryAny?.wallet;
  const tendersApplied = (giftCodes.length > 0 || walletChosen) && typeof summaryAny?.amountDue === 'number';
  const paymentAmount: PaymentAmount = {
    amount: tendersApplied ? summaryAny.amountDue : total,
    currency: 'USD',
    // The stored cart this amount was quoted for; the server checks the amount against it.
    cartId: cartSummary?.cartId,
    partial: tendersApplied,
  };
  // Gift cards and store credit / points between them cover the whole order: it is placed with no card payment.
  const coveredWithoutCard = tendersApplied && summaryAny.amountDue === 0 && giftCardTotal + walletTotal > 0;
  const coveredBy = [
    giftCardTotal > 0 ? 'gift card' : '',
    (walletSummary?.storeCreditApplied || 0) > 0 ? 'store credit' : '',
    (walletSummary?.pointsApplied || 0) > 0 ? 'points' : '',
  ].filter(Boolean);
  const coveredByText = coveredBy.length > 1 ? `${coveredBy.slice(0, -1).join(', ')} and ${coveredBy[coveredBy.length - 1]}` : coveredBy[0] || 'gift card';
  // Shown only when the server says the signed-in shopper has a wallet with something in it (or a choice is already made).
  const showWallet = !!walletSummary && (walletChosen || walletSummary.storeCreditBalance > 0 || walletSummary.pointsBalance > 0);

  const setGiftCodes = (codes: string[]) => {
    updateField({ giftCards: codes });
    setGiftAsk((n) => n + 1);
  };
  // Lines paid with reward points (signed-in shoppers only). The server prices them, counts the points and
  // says whether the shopper has enough; an order short of points is refused before anything is charged.
  const signedIn = !!storefrontAPI.getCustomerFromSession();
  const pointsLines: { required?: number; balance?: number; problem?: string } | undefined = summaryAny?.rewardPointsLines;
  const pointsBalance: number | undefined = pointsLines?.balance ?? walletSummary?.pointsBalance;
  const localLineFor = (line: any) =>
    (line?.cartItemId && productItems.find((i) => i.cartItemId === line.cartItemId)) || productItems.find((i) => findPricedProductLine([line], i));
  const pointsProps = signedIn
    ? {
        pointsBalance,
        pointsProblem: pointsLines?.problem,
        pointsBusy: cartLoading,
        isPayingWithPoints: (line: any) => !!localLineFor(line)?.payWithPoints,
        onPayWithPoints: (line: any, on: boolean) => {
          const local = localLineFor(line);
          if (local?.cartItemId) setLinePayWithPoints(local.cartItemId, on);
        },
      }
    : {};
  // Everything is paid with points (nothing left in money): the order is placed with no card.
  const paidAllWithPoints = (pointsLines?.required || 0) > 0 && !pointsLines?.problem && total === 0;

  const setWalletChoice = (choice: CheckoutWalletChoice) => {
    updateField({ wallet: choice.storeCredit !== undefined || choice.points !== undefined ? choice : undefined });
  };

  // For rental-only carts, use billing address; for product carts, use shipping address
  // SDK AddressSchema: street1, street2, name
  const customerAddress = checkoutData?.shippingAddress?.street1 ? checkoutData.shippingAddress : checkoutData?.billingAddress;

  const paymentCustomer: PaymentCustomerInfo = {
    name: checkoutData?.name || customerAddress?.name || '',
    email: checkoutData?.email || '',
    phone: checkoutData?.phone || '',
    address: customerAddress
      ? {
          line1: customerAddress.street1,
          line2: customerAddress.street2,
          city: customerAddress.city,
          state: customerAddress.state,
          postal_code: customerAddress.zip,
          country: customerAddress.country,
        }
      : undefined,
  };

  // Appmint One: the store's checkout look — a split page (the form on white, the order on the
  // store's tint), no site navigation. Steps, quotes and payment below are base-app's.
  return (
    <div className="sf-co">
      <div className="sf-co-main">
        <div className="sf-co-main-in">
        {/* Header */}
        <div className="sf-co-hd">
          <button
            onClick={() => {
              const currentPath = window.location.pathname;
              if (currentPath.includes('/preview/')) {
                router.push(`/preview/${storePage}`);
              } else {
                router.push(`/${storePage}`);
              }
            }}
            className="sf-co-back"
          >
            <ArrowLeft className="w-4 h-4" />
            Continue shopping
          </button>
          <h1>Checkout</h1>
        </div>

        {/* Buying for a shared account: say so where the order is placed, not only in the cart. */}
        {orderingFor && (
          <div className="-mt-8 mb-8 flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>
              Ordering for <strong>{orderingFor}</strong>: this order is billed to the account at its prices.
            </span>
          </div>
        )}

        {/* Mobile Order Summary */}
        <details className="sf-co-mobile-sum">
          <summary>
            <span>Order summary <ChevronDownIcon /></span>
            <b>{quoteReady && total ? `$${Number(total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</b>
          </summary>
          <CheckoutCart
            productItems={cartSummary?.productItems || productItems}
            rentalItems={cartSummary?.rentalItems || rentalItems}
            subtotal={subtotal}
            tax={tax}
            discount={discount}
            total={total}
            rentalSubtotal={rentalSubtotal}
            rentalDeposit={rentalDeposit}
            rentalTax={rentalTax}
            rentalDeliveryFee={rentalDeliveryFee}
            rentalTotal={rentalTotal}
            productSubtotal={productSubtotal}
            productTax={productTax}
            productShipping={productShipping}
            productTotal={productTotal}
            couponCode={couponCode}
            setCouponCode={setCouponCode}
            applyCoupon={applyCoupon}
            shippingOptions={[]}
            selectedShipping={null}
            onSelectShipping={() => {}}
            shippingLoading={cartLoading && !quoteRefreshing}
            quoteUnavailable={cartError || (!quoteReady && !quoteRefreshing ? 'Awaiting current quote' : undefined)}
            shippingBlocked={shippingBlocked}
            appliedPromotions={serverDiscountsAsPromotions}
            onRemovePromotion={handleRemovePromotion}
            couponError={couponError}
            couponLoading={couponLoading}
            customerBenefits={customerBenefits}
            mobileCollapsibleProducts
            {...pointsProps}
          />
        </details>

        <div className="sf-co-cols">
          {/* Left: Form */}
          <div className="sf-co-steps">
            {cartError && (
              <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
                <p className="font-semibold">Delivery quote unavailable</p>
                <p>{cartError}</p>
                <p>Check your delivery address or contact the shop. Payment is unavailable until this order has a valid quote.</p>
                <button type="button" onClick={fetchCartSummary} disabled={cartLoading} className="mt-2 underline disabled:opacity-50">Retry quote</button>
              </div>
            )}
            {/* Customer Info Component */}
            <CustomerInfo
              formData={{
                email: checkoutData?.email || '',
                phone: checkoutData?.phone || '',
                shippingAddress: checkoutData?.shippingAddress || { name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'US' },
                billingAddress: checkoutData?.billingAddress || { name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'US' },
                useSameForBilling: !checkoutData?.billingAddress,
              }}
              setFormData={(updates) => {
                const current = checkoutData || {
                  email: '',
                  name: '',
                  phone: '',
                  shippingAddress: { name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'US' },
                  billingAddress: undefined,
                  subtotal: 0,
                  shipping: 0,
                  tax: 0,
                  discount: 0,
                  total: 0,
                  paymentGateway: 'stripe',
                  currency: 'USD',
                };

                const newData = { ...current };

                if ('email' in updates) newData.email = updates.email;
                if ('phone' in updates) newData.phone = updates.phone;
                if ('shippingAddress' in updates) {
                  newData.shippingAddress = updates.shippingAddress;
                  // Also update top-level name from shipping address
                  if (updates.shippingAddress?.name) {
                    newData.name = updates.shippingAddress.name;
                  }
                }
                if ('billingAddress' in updates) newData.billingAddress = updates.billingAddress;
                if ('useSameForBilling' in updates) {
                  newData.billingAddress = updates.useSameForBilling ? undefined : (current.billingAddress || { name: '', street1: '', street2: '', city: '', state: '', zip: '', country: 'US' });
                }

                setCheckoutData(newData);
              }}
              editingSection={editingSection}
              completedSections={completedSections}
              completeSection={completeSection}
              editSection={editSection}
              isRentalOnly={productItems.length === 0 && rentalItems.length > 0}
            />

            {addressChecking && (
              <p role="status" className="text-sm text-slate-600">Checking your delivery address with the carrier…</p>
            )}
            {addressCheck && (
              <div
                role="alert"
                data-testid="checkout-address-check"
                data-status={addressCheck.status}
                className={`rounded-xl border p-4 ${addressCheck.status === 'undeliverable' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}
              >
                <p className="font-semibold">{addressCheck.status === 'undeliverable' ? 'We couldn\'t confirm this address' : 'Did you mean this address?'}</p>
                <p className="text-sm mt-1">{addressCheck.message}</p>
                {addressCheck.status === 'corrected' && addressCheck.suggestedAddress && (
                  <div className="mt-3 rounded border border-amber-200 bg-white p-3 text-sm text-slate-800">
                    <p className="font-medium">Suggested address</p>
                    <p>{addressCheck.suggestedAddress.street1}{addressCheck.suggestedAddress.street2 ? `, ${addressCheck.suggestedAddress.street2}` : ''}</p>
                    <p>{addressCheck.suggestedAddress.city}, {addressCheck.suggestedAddress.state} {addressCheck.suggestedAddress.zip}</p>
                    {!!addressCheck.corrections?.length && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                        {addressCheck.corrections.map((c) => (
                          <li key={c.field}>{c.from || '(blank)'} → {c.to || '(blank)'}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {addressCheck.status === 'corrected' ? (
                    <button type="button" onClick={applySuggestedAddress} className="px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium">Use suggested address</button>
                  ) : (
                    <button type="button" onClick={() => { setAddressCheck(null); editSection('shipping'); }} className="px-4 py-2 rounded bg-slate-900 text-white text-sm font-medium">Edit address</button>
                  )}
                  <button type="button" onClick={keepTypedAddress} className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-800 text-sm font-medium">
                    {addressCheck.status === 'corrected' ? 'Keep the address I entered' : 'Use this address anyway'}
                  </button>
                </div>
              </div>
            )}

            {/* Rental Fulfillment - always show for rental carts */}
            {hasRentalItems && (
              <RentalFulfillment
                data={rentalFulfillment}
                onChange={setRentalFulfillment}
                pickupLocation={pickupLocation}
                editingSection={editingSection}
                setEditingSection={setEditingSection}
                completedSections={completedSections}
                completeSection={completeSection}
                editSection={editSection}
                rentalItems={rentalItems}
              />
            )}

            {/* Payment Gateways Component - only render when cart summary is loaded */}
            {shippingBlocked && quoteReady ? (
              // A shop rule, not an error: the item doesn't ship to this address. Prices stay; payment waits.
              <div role="status" className="bg-amber-50 rounded-2xl p-6 border border-amber-200 text-amber-900">
                <p className="font-semibold">{shippingBlocked}</p>
                <p className="mt-1 text-sm text-amber-800">Edit the shipping address above to continue to payment.</p>
              </div>
            ) : pointsLines?.problem && quoteReady ? (
              // Not enough points for the lines set to points: the server would refuse the order, so nothing is charged.
              <div role="status" className="bg-amber-50 rounded-2xl p-6 border border-amber-200 text-amber-900">
                <p className="font-semibold">{pointsLines.problem}</p>
                <p className="mt-1 text-sm text-amber-800">Switch a line in your order summary back to paying with money to continue to payment.</p>
              </div>
            ) : paidAllWithPoints && quoteReady ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 space-y-4">
                <p className="text-slate-700">
                  Nothing to pay by card: this order is paid with {new Intl.NumberFormat('en-US').format(pointsLines?.required || 0)} points. They come off your balance when the order is placed.
                </p>
                <button
                  type="button"
                  disabled={cartLoading}
                  onClick={() =>
                    handlePaymentSuccess({
                      success: true,
                      payment_intent_id: GIFT_CARDS_ONLY,
                      transaction_id: GIFT_CARDS_ONLY,
                      // No card payment to record: the server spends the points with the order.
                      metadata: { gateway: 'wallet' },
                    })
                  }
                  className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Place order — paid with points
                </button>
              </div>
            ) : (quoteReady || quoteRefreshing) && total > 0 ? (
              <div aria-busy={quoteRefreshing} className={quoteRefreshing ? 'pointer-events-none' : undefined}>
              <PaymentGateways
                // A new amount needs a new payment intent; the card form makes
                // its intent once, when it mounts.
                key={`pay-${paymentAmount.amount}-${paymentAmount.cartId || ''}`}
                lead={
                  <>
                    <CheckoutGiftCards
                      codes={giftCodes}
                      cards={summaryAny?.giftCards}
                      giftCardTotal={summaryAny?.giftCardTotal}
                      amountDue={summaryAny?.amountDue}
                      loading={cartLoading}
                      signedIn={!!storefrontAPI.getCustomerFromSession()}
                      note={summaryAny?.giftCardExcludedReason}
                      onChange={setGiftCodes}
                    />
                    {showWallet && (
                      <CheckoutStoreCredit
                        wallet={walletSummary}
                        walletTotal={walletTotal}
                        amountDue={summaryAny?.amountDue}
                        choice={walletChoice}
                        loading={cartLoading}
                        onChange={setWalletChoice}
                      />
                    )}
                  </>
                }
                settled={
                  coveredWithoutCard ? (
                    <button
                      type="button"
                      disabled={cartLoading}
                      onClick={() =>
                        handlePaymentSuccess({
                          success: true,
                          payment_intent_id: GIFT_CARDS_ONLY,
                          transaction_id: GIFT_CARDS_ONLY,
                          // No card payment to record: the server spends the gift cards and the wallet with the order.
                          metadata: { gateway: giftCardTotal > 0 ? 'giftcard' : 'wallet' },
                        })
                      }
                      className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Place order — paid with {coveredByText}
                    </button>
                  ) : undefined
                }
                // Gift cards and store credit are applied above; the old account-balance gateway is replaced by the wallet.
                excludeProviders={['GiftCardProvider', 'AccountBalanceProvider']}
                paymentGateways={paymentGateways}
                editingSection={editingSection}
                completedSections={completedSections}
                completeSection={completeSection}
                editSection={editSection}
                amount={paymentAmount}
                customer={paymentCustomer}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
              />
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-500">
                  {!cartError && cartLoading && <div className="animate-spin h-5 w-5 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>}
                  <span>{cartError ? 'Payment unavailable — resolve the delivery quote above.' : hasProductItems && !shippingAddressComplete ? 'Enter your delivery address to see available payment methods.' : 'Updating order quote...'}</span>
                </div>
              </div>
            )}
          </div>

        </div>
        </div>
      </div>
          {/* Right: Order summary - Desktop only (hidden below 1024px) */}
          <aside className="sf-co-aside"><div className="sf-co-aside-in">
            <CheckoutCart
              productItems={cartSummary?.productItems || productItems}
              rentalItems={cartSummary?.rentalItems || rentalItems}
              subtotal={subtotal}
              tax={tax}
              discount={discount}
              total={total}
              rentalSubtotal={rentalSubtotal}
              rentalDeposit={rentalDeposit}
              rentalTax={rentalTax}
              rentalDeliveryFee={rentalDeliveryFee}
              rentalTotal={rentalTotal}
              productSubtotal={productSubtotal}
              productTax={productTax}
              productShipping={productShipping}
              productTotal={productTotal}
              couponCode={couponCode}
              setCouponCode={setCouponCode}
              applyCoupon={applyCoupon}
              shippingOptions={[]}
              selectedShipping={null}
              onSelectShipping={() => {}}
              shippingLoading={cartLoading && !quoteRefreshing}
            quoteUnavailable={cartError || (!quoteReady && !quoteRefreshing ? 'Awaiting current quote' : undefined)}
            shippingBlocked={shippingBlocked}
              appliedPromotions={serverDiscountsAsPromotions}
              onRemovePromotion={handleRemovePromotion}
              couponError={couponError}
              couponLoading={couponLoading}
              customerBenefits={customerBenefits}
              {...pointsProps}
            />
          </div></aside>
    </div>
  );
};
