// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
// from base-app/src/store/cart-store.ts — ported verbatim; only import paths rewired.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toast } from '@/modules/store/shims/sonner';
import { optionsFingerprint, type LineItemDesign, type LineItemOption } from '@/modules/store/components/storefront/utils/custom-attributes';

// Cart item matches SDK sf-cart CartItemSchema
export interface CartItem {
  id: string;
  cartItemId?: string; // Unique ID for cart item including attributes
  name: string;
  sku: string;
  // SDK uses unitPrice as the primary price field
  unitPrice: number;
  quantity: number;
  image: string;
  // amount = unitPrice * quantity (calculated by server)
  amount?: number;
  discount?: number;
  discountCode?: string;
  attributes?: Record<string, any>;
  // Additional pricing fields from server
  originalPrice?: number; // Price before any discounts
  finalPrice?: number; // Alias for unitPrice after discounts
  lineTotal?: number; // amount + fees (server-calculated)
  lineTotalWithDeposit?: number;
  appliedRule?: string;
  tierDiscount?: number;
  groupDiscount?: number;
  categoryId?: string;
  // Per-item deposit (for rentals - at root level for consistency with SDK)
  deposit?: number;
  depositWaived?: boolean;
  waived?: boolean;
  /** A signed-in shopper chose to pay for this line with reward points; the server prices it (money 0) and checks the balance. */
  payWithPoints?: boolean;
  // Item type - product or rental
  itemType?: 'product' | 'rental' | 'fee' | 'addon';
  parentSku?: string;
  // Chosen attribute values. Preset picks are `{ name, value }`; customer-supplied
  // ones carry `type` and, for uploads, the FileInfo objects that survive to the order.
  options?: LineItemOption[];
  // Flattened design proof + placement snapshot for customizable products
  design?: LineItemDesign;
  // Rental-specific fields
  rentalId?: string;
  startDate?: string;
  endDate?: string;
  rentalPeriod?: 'hourly' | 'daily' | 'weekly' | 'monthly';
  duration?: number;
  timezone?: string;
  fees?: Array<{ name: string; amount: number; waived?: boolean }>;
  feesTotal?: number;
  selectedFees?: string[];
  // Rental fulfillment (SDK schema)
  fulfillment?: {
    type?: 'pickup' | 'delivery';
    address?: {
      street1?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    instructions?: string;
    fee?: number;
    feeWaived?: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
    distance?: number;
    // Legacy fields for backward compat
    allowPickup?: boolean;
    allowDelivery?: boolean;
    allowDropoff?: boolean;
    allowReturnPickup?: boolean;
    deliveryFee?: number;
    returnPickupFee?: number;
  };
  // Rental return (SDK schema)
  return?: {
    type?: 'dropoff' | 'pickup';
    address?: {
      street1?: string;
      street2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    instructions?: string;
    fee?: number;
    feeWaived?: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
    distance?: number;
  };
  // Pickup location for rental items
  pickupLocation?: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    hours?: string;
    phone?: string;
  };
}

// Shipping calculation result
export interface ShippingOption {
  id: string;
  carrier?: string;
  service?: string;
  name: string;
  cost: number;
  customerPrice: number;
  deliveryDays?: number;
  deliveryDate?: string;
}

// Applied promotion/discount
export interface AppliedPromotion {
  id?: string;
  name: string;
  code?: string;
  type: string; // Server can send any promotion type
  value: number;
  appliedAmount: number;
  autoApplied: boolean;
  message?: string;
  /** A promotion that gives points or store credit instead of money off: the server's sentence ("You'll get 500 points"). */
  note?: string;
}

// Customer benefits from tier/group
export interface CustomerBenefits {
  groups: string[];
  discountPercent: number;
  freeShipping: boolean;
  freeShippingMinimum?: number;
  earlyAccess: boolean;
  prioritySupport: boolean;
  bonusPointsMultiplier: number;
  tierName?: string;
  tierBadge?: string;
}

// SDK AddressSchema: name, street1, street2, city, state, zip, country, phone, email, company
export interface AddressData {
  name?: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  company?: string;
}

/** What a signed-in shopper asked to spend from their store credit and reward points: an amount / whole points, or 'max' for all that helps. */
export interface CheckoutWalletChoice {
  storeCredit?: number | 'max';
  points?: number | 'max';
}

export interface CheckoutData {
  email: string;
  name: string;
  phone: string;
  shippingAddress: AddressData;
  billingAddress?: AddressData;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  discountCode?: string;
  total: number;
  paymentGateway: string;
  currency: string;
  cartId?: string;
  paymentIntentId?: string;
  /** Gift card codes applied at checkout, spent by the server when the order is placed. PINs live in session storage. */
  giftCards?: string[];
  /** Store credit / reward points a signed-in shopper chose to use; spent by the server, after gift cards, when the order is placed. */
  wallet?: CheckoutWalletChoice;
  // Rental fulfillment options
  rentalFulfillment?: {
    fulfillment: {
      type: 'pickup' | 'delivery';
      address?: AddressData;
      instructions?: string;
    };
    return: {
      type: 'dropoff' | 'pickup';
      address?: AddressData;
      instructions?: string;
    };
  };
}

interface CartState {
  items: CartItem[];
  checkoutData: CheckoutData | null;
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  /** Switch one line between paying with money and paying with reward points. */
  setLinePayWithPoints: (cartItemId: string, payWithPoints: boolean) => void;
  clearCart: () => void;
  restoreSavedCart: (items: CartItem[]) => boolean;
  getSubtotal: () => number;
  getItemCount: () => number;
  isOpen: boolean;
  toggleCart: () => void;
  setCheckoutData: (data: CheckoutData | null) => void;
  updateCheckoutField: (field: string, value: any) => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Unified cart - separate getters for products and rentals
  getProductItems: () => CartItem[];
  getRentalItems: () => CartItem[];
  getProductSubtotal: () => number;
  getRentalSubtotal: () => number;
  getRentalDeposit: () => number;
  clearProducts: () => void;
  clearRentals: () => void;
  updateRentalDates: (cartItemId: string, startDate: string, endDate: string) => void;

  // Enhanced pricing state
  pricingLoading: boolean;
  pricingError: string | null;
  calculatedSubtotal: number | null;
  totalDiscount: number | null;
  /**
   * The cart summary exactly as `storefront/pricing/calculate-cart` returned it.
   *
   * Money is decided by the server and nowhere else. Web, mobile and every
   * other channel read the same numbers, so any figure re-derived here would
   * be a second opinion that drifts from what the customer is actually
   * charged. Every getter below reads this and never computes.
   */
  serverPricing: ServerCartPricing | null;
  updateItemPricing: (cartItemId: string, pricing: Partial<CartItem>) => void;
  setPricingLoading: (loading: boolean) => void;
  setPricingError: (error: string | null) => void;
  setCalculatedPricing: (subtotal: number, discount: number) => void;
  setServerPricing: (pricing: ServerCartPricing | null) => void;
  /** False until the server has priced this cart — render a placeholder, not a number. */
  pricingReady: () => boolean;
  getTax: () => number;

  // Shipping state
  shippingOptions: ShippingOption[];
  selectedShipping: ShippingOption | null;
  shippingLoading: boolean;
  shippingError: string | null;
  setShippingOptions: (options: ShippingOption[]) => void;
  selectShipping: (option: ShippingOption | null) => void;
  setShippingLoading: (loading: boolean) => void;
  setShippingError: (error: string | null) => void;

  // Promotions state
  appliedPromotions: AppliedPromotion[];
  availablePromotions: AppliedPromotion[];
  couponCode: string;
  couponError: string | null;
  addPromotion: (promotion: AppliedPromotion) => void;
  removePromotion: (name: string) => void;
  setAvailablePromotions: (promotions: AppliedPromotion[]) => void;
  setCouponCode: (code: string) => void;
  setCouponError: (error: string | null) => void;
  clearPromotions: () => void;

  // Customer benefits state
  customerBenefits: CustomerBenefits | null;
  setCustomerBenefits: (benefits: CustomerBenefits | null) => void;

  // Computed totals
  getShippingCost: () => number;
  getTotalDiscount: () => number;
  getTotal: () => number;
}

/**
 * The server's cart summary. Field names mirror the `calculate-cart` response
 * (see appengine `discount.service.ts`) so nothing is renamed on the way in.
 */
export interface ServerCartPricing {
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  deposit?: number;
  productShipping?: number;
  productSubtotal?: number;
  productTotal?: number;
  rentalSubtotal?: number;
  rentalTotal?: number;
  freeShipping?: boolean;
  shippingMethod?: any;
  shippingOptions?: any[];
  currency?: string;
  [key: string]: any;
}

const generateCartItemId = (item: CartItem) => {
  if (item.itemType === 'rental') {
    // For rentals, include dates in the ID
    return `rental-${item.sku}-${item.startDate}-${item.endDate}`;
  }
  // For products, include attributes
  const attrStr = item.attributes
    ? Object.keys(item.attributes)
        .sort()
        .map((key) => `${key}:${item.attributes![key]}`)
        .join('|')
    : '';
  // Customer-supplied options (uploaded artwork, print notes) make two
  // otherwise-identical lines distinct - without the file paths here,
  // two shirts with different artwork would merge into one line
  const optionsStr = optionsFingerprint(item.options);
  return `product-${item.id}-${item.sku}-${attrStr}${optionsStr ? `-${optionsStr}` : ''}`;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      checkoutData: null,
      _hasHydrated: false,

      // Enhanced pricing state
      pricingLoading: false,
      pricingError: null,
      calculatedSubtotal: null,
      totalDiscount: null,
      serverPricing: null,

      // Shipping state
      shippingOptions: [],
      selectedShipping: null,
      shippingLoading: false,
      shippingError: null,

      // Promotions state
      appliedPromotions: [],
      availablePromotions: [],
      couponCode: '',
      couponError: null,

      // Customer benefits state
      customerBenefits: null,

      addItem: (newItem) => {
        const cartItemId = newItem.cartItemId || generateCartItemId(newItem);
        let isNewItem = false;

        set((state) => {
          const existingItemIndex = state.items.findIndex((item) => item.cartItemId === cartItemId);

          // The cart changed, so its server price no longer applies — readers show "updating" until it is repriced.
          if (existingItemIndex > -1) {
            // Item exists, update quantity (a new object, so every subscriber sees the change)
            const updatedItems = state.items.map((item, i) => (i === existingItemIndex ? { ...item, quantity: item.quantity + newItem.quantity } : item));
            return { items: updatedItems, serverPricing: null, calculatedSubtotal: null, totalDiscount: null };
          } else {
            // Item doesn't exist, add new item (default to product if not specified)
            isNewItem = true;
            return {
              items: [...state.items, { ...newItem, cartItemId, itemType: newItem.itemType || 'product' }],
              serverPricing: null,
              calculatedSubtotal: null,
              totalDiscount: null,
            };
          }
        });

        // Show toast notification (client-side only)
        if (typeof window !== 'undefined') {
          const itemType = newItem.itemType === 'rental' ? 'Rental' : 'Item';
          const message = isNewItem ? `${itemType} added to cart` : `${itemType} quantity updated`;

          toast.success(
            `${newItem.name}`,
            {
              description: message,
              duration: 3000,
              position: 'bottom-center',
            }
          );
        }
      },

      removeItem: (cartItemId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.cartItemId !== cartItemId),
          // Reset calculated pricing so it gets refetched
          serverPricing: null,
          calculatedSubtotal: null,
          totalDiscount: null,
        }));
      },
      updateQuantity: (cartItemId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(cartItemId);
          return;
        }
        set((state) => ({
          items: state.items.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity } : item)),
          // Reset calculated pricing so it gets refetched
          serverPricing: null,
          calculatedSubtotal: null,
          totalDiscount: null,
        }));
      },
      setLinePayWithPoints: (cartItemId: string, payWithPoints: boolean) => {
        set((state) => ({
          items: state.items.map((item) => (item.cartItemId === cartItemId ? { ...item, payWithPoints: payWithPoints || undefined } : item)),
          // The line's price changes: the server prices it again
          serverPricing: null,
          calculatedSubtotal: null,
          totalDiscount: null,
        }));
      },
      restoreSavedCart: (items) => {
        // A late recovery response must not replace items added in the meantime.
        if (get().items.length) return false;
        set({ items: items.map(item => ({ ...item, cartItemId: item.cartItemId || generateCartItemId(item) })), serverPricing: null });
        return true;
      },
      clearCart: () => {
        // A placed order uses up its promo code: the next checkout must not re-apply it on load (and show a stale refusal).
        set({ items: [], checkoutData: null, serverPricing: null, calculatedSubtotal: null, totalDiscount: null, couponCode: '', couponError: null, appliedPromotions: [] });
      },

      // Unified cart - separate getters for products and rentals
      getProductItems: () => {
        const { items } = get();
        // Exclude items that are explicitly rental OR have rental-specific fields
        return items.filter((item) =>
          item.itemType !== 'rental' &&
          !(item.startDate && item.endDate)
        );
      },
      getRentalItems: () => {
        const { items } = get();
        // Filter by itemType === 'rental' OR by presence of rental-specific fields
        return items.filter((item) =>
          item.itemType === 'rental' ||
          (item.startDate && item.endDate)
        );
      },
      getProductSubtotal: () => {
        return get().serverPricing?.productSubtotal ?? 0;
      },
      getRentalSubtotal: () => {
        return get().serverPricing?.rentalSubtotal ?? 0;
      },
      getRentalDeposit: () => {
        return get().serverPricing?.deposit ?? 0;
      },
      clearProducts: () => {
        set((state) => ({
          // Keep items that are rental OR have rental-specific fields
          items: state.items.filter((item) =>
            item.itemType === 'rental' || (item.startDate && item.endDate)
          ),
        }));
      },
      clearRentals: () => {
        set((state) => ({
          // Keep items that are NOT rental AND don't have rental-specific fields
          items: state.items.filter((item) =>
            item.itemType !== 'rental' && !(item.startDate && item.endDate)
          ),
        }));
      },
      updateRentalDates: (cartItemId: string, startDate: string, endDate: string) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.cartItemId === cartItemId ? { ...item, startDate, endDate } : item
          ),
        }));
      },

      getSubtotal: () => {
        // Server figure only. There is deliberately no fallback that re-adds
        // the line items: a locally summed subtotal looks right and quietly
        // disagrees with the invoice the moment a price rule, a price list or
        // a rental duration is resolved differently on the server.
        return get().serverPricing?.subtotal ?? get().calculatedSubtotal ?? 0;
      },
      getItemCount: () => {
        const { items } = get();
        return items.reduce((count, item) => count + item.quantity, 0);
      },
      isOpen: false,
      toggleCart: () => {
        set((state) => ({ isOpen: !state.isOpen }));
      },
      setCheckoutData: (data: CheckoutData | null) => {
        set({ checkoutData: data });
      },
      updateCheckoutField: (field: string, value: any) => {
        set((state) => ({
          checkoutData: state.checkoutData ? { ...state.checkoutData, [field]: value } : null,
        }));
      },
      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state });
      },

      // Enhanced pricing methods - update by cartItemId or SKU
      updateItemPricing: (identifier: string, pricing: Partial<CartItem>) => {
        console.log('[CartStore] updateItemPricing called:', { identifier, pricing });
        set((state) => {
          const updatedItems = state.items.map((item) => {
            // Match by cartItemId first, then by SKU
            const matches = item.cartItemId === identifier ||
              item.sku === identifier ||
              item.sku?.toLowerCase() === identifier?.toLowerCase();
            if (matches) {
              console.log('[CartStore] Updating item:', { sku: item.sku, cartItemId: item.cartItemId, newPricing: pricing });
              return { ...item, ...pricing };
            }
            return item;
          });
          return { items: updatedItems };
        });
      },
      setPricingLoading: (loading: boolean) => {
        set({ pricingLoading: loading });
      },
      setPricingError: (error: string | null) => {
        set({ pricingError: error });
      },
      setCalculatedPricing: (subtotal: number, discount: number) => {
        set({ calculatedSubtotal: subtotal, totalDiscount: discount });
      },
      setServerPricing: (pricing: ServerCartPricing | null) => {
        // Keep the two legacy fields in step so existing readers stay correct.
        set({
          serverPricing: pricing,
          calculatedSubtotal: pricing?.subtotal ?? null,
          totalDiscount: pricing?.discount ?? null,
        });
      },
      pricingReady: () => get().serverPricing !== null,

      // Shipping methods
      setShippingOptions: (options: ShippingOption[]) => {
        set({ shippingOptions: options });
      },
      selectShipping: (option: ShippingOption | null) => {
        set({ selectedShipping: option });
      },
      setShippingLoading: (loading: boolean) => {
        set({ shippingLoading: loading });
      },
      setShippingError: (error: string | null) => {
        set({ shippingError: error });
      },

      // Promotions methods
      addPromotion: (promotion: AppliedPromotion) => {
        set((state) => {
          // Don't add duplicate promotions
          if (state.appliedPromotions.some((p) => p.name === promotion.name)) {
            return state;
          }
          return {
            appliedPromotions: [...state.appliedPromotions, promotion],
          };
        });
      },
      removePromotion: (name: string) => {
        set((state) => ({
          appliedPromotions: state.appliedPromotions.filter((p) => p.name !== name),
        }));
      },
      setAvailablePromotions: (promotions: AppliedPromotion[]) => {
        set({ availablePromotions: promotions });
      },
      setCouponCode: (code: string) => {
        set({ couponCode: code, couponError: null });
      },
      setCouponError: (error: string | null) => {
        set({ couponError: error });
      },
      clearPromotions: () => {
        set({
          appliedPromotions: [],
          couponCode: '',
          couponError: null,
        });
      },

      // Customer benefits methods
      setCustomerBenefits: (benefits: CustomerBenefits | null) => {
        set({ customerBenefits: benefits });
      },

      // ── Money: read from the server summary, never computed here ────────
      getShippingCost: () => {
        const { serverPricing, selectedShipping } = get();
        // The chosen option's price is itself a server figure; the summary
        // wins because it already accounts for free-shipping discounts.
        return serverPricing?.productShipping ?? selectedShipping?.customerPrice ?? 0;
      },
      getTotalDiscount: () => {
        // No summing of applied promotions — the server already netted them
        // off, and adding them again double-counts stacked rules.
        return get().serverPricing?.discount ?? get().totalDiscount ?? 0;
      },
      getTax: () => {
        return get().serverPricing?.tax ?? 0;
      },
      getTotal: () => {
        // The amount to charge, exactly as the server decided it. This used to
        // be `subtotal + shipping - discount`, which silently dropped tax and
        // gave web a different number from mobile and POS for the same cart.
        return get().serverPricing?.total ?? 0;
      },
    }),
    {
      name: 'cart-storage',
      // What survives a reload: the basket and the checkout in progress. NOT
      // whether the drawer happened to be open — persisting that reopened the
      // cart over the page on every refresh, which reads as the site being
      // broken rather than as a cart being remembered.
      partialize: (state: any) => {
        const { isOpen, pricingLoading, pricingError, _hasHydrated, ...kept } = state;
        return kept;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // A drawer is a moment, not a preference.
          state.isOpen = false;
          // Heal any line items rehydrated from older builds where the runtime
          // wrote a malformed quantity / unitPrice (NaN / null / undefined).
          // Without this, React renders <input value={NaN}> and warns about
          // null `value` props on every cart open.
          if (Array.isArray(state.items)) {
            state.items = state.items.map((it: any) => {
              const cleaned: any = {
                ...it,
                quantity:  Number.isFinite(Number(it?.quantity))  && it.quantity  > 0 ? it.quantity  : 1,
                unitPrice: Number.isFinite(Number(it?.unitPrice)) ? Number(it.unitPrice) : 0,
              };
              // Drop `attributes` if it's the variant schema (array) or
              // anything that's not a flat key-value map of chosen values.
              // The Cart drawer renders attribute objects as React children;
              // a schema array there crashes the render with "Objects are
              // not valid as a React child {name, options}".
              if (Array.isArray(cleaned.attributes) || (cleaned.attributes && typeof cleaned.attributes !== 'object')) {
                delete cleaned.attributes;
              }
              return cleaned;
            });
          }
          state.setHasHydrated(true);
        }
      },
    },
  ),
);

// Expose cart store on window for global access
if (typeof window !== 'undefined') {
  (window as any).cartStore = {
    // Core cart methods
    toggleCart: () => useCartStore.getState().toggleCart(),
    getItemCount: () => useCartStore.getState().getItemCount(),
    getSubtotal: () => useCartStore.getState().getSubtotal(),
    addItem: (item: CartItem) => useCartStore.getState().addItem(item),
    removeItem: (id: string) => useCartStore.getState().removeItem(id),
    updateQuantity: (id: string, qty: number) => useCartStore.getState().updateQuantity(id, qty),
    clearCart: () => useCartStore.getState().clearCart(),
    getItems: () => useCartStore.getState().items,
    isOpen: () => useCartStore.getState().isOpen,

    // Unified cart - products and rentals
    getProductItems: () => useCartStore.getState().getProductItems(),
    getRentalItems: () => useCartStore.getState().getRentalItems(),
    getProductSubtotal: () => useCartStore.getState().getProductSubtotal(),
    getRentalSubtotal: () => useCartStore.getState().getRentalSubtotal(),
    getRentalDeposit: () => useCartStore.getState().getRentalDeposit(),
    clearProducts: () => useCartStore.getState().clearProducts(),
    clearRentals: () => useCartStore.getState().clearRentals(),

    // Pricing methods
    getCalculatedSubtotal: () => useCartStore.getState().calculatedSubtotal,
    getTotalDiscount: () => useCartStore.getState().getTotalDiscount(),
    getTotal: () => useCartStore.getState().getTotal(),

    // Shipping methods
    getShippingOptions: () => useCartStore.getState().shippingOptions,
    getSelectedShipping: () => useCartStore.getState().selectedShipping,
    selectShipping: (option: ShippingOption) => useCartStore.getState().selectShipping(option),
    getShippingCost: () => useCartStore.getState().getShippingCost(),

    // Promotions methods
    getAppliedPromotions: () => useCartStore.getState().appliedPromotions,
    getAvailablePromotions: () => useCartStore.getState().availablePromotions,
    getCouponCode: () => useCartStore.getState().couponCode,
    setCouponCode: (code: string) => useCartStore.getState().setCouponCode(code),

    // Customer benefits
    getCustomerBenefits: () => useCartStore.getState().customerBenefits,

    // Expose subscribe for reactive bindings
    subscribe: (callback: () => void) => useCartStore.subscribe(callback),
  };

  // Also expose useCartStore directly for advanced usage
  (window as any).useCartStore = useCartStore;

  // Subscribe to store changes and dispatch custom event for binding-runtime
  useCartStore.subscribe((state, prevState) => {
    if (state.items !== prevState.items) {
      window.dispatchEvent(new CustomEvent('cartupdate', {
        detail: {
          items: state.items,
          itemCount: state.getItemCount(),
          subtotal: state.getSubtotal(),
        }
      }));
    }
  });
}
