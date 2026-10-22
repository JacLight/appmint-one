// from base-app/src/lib/storefront-api.ts — ported verbatim; only import paths rewired.
import { getAppEngineClient } from './appmint-client';
import { API_ENDPOINTS, appmintEndpoints } from './appmint-endpoints';
import { CartItem, type CheckoutWalletChoice } from '@/modules/store/store/cart-store';
import { activeSession } from './active-session';
import { getResponseErrorMessage } from '@/modules/store/lib-client/helpers';

// Helper to get customer context for pricing
const getCustomerContext = () => {
  if (typeof window === 'undefined') return {};

  const user = activeSession.getUser();
  if (!user) return {};

  return {
    customerId: user.sk || user.id,
    email: user.data?.email || user.email,
    customerGroups: user.groups || user.customerGroups || [],
    tier: user.tier || user.customerTier,
  };
};

export interface Product {
  sk: string;
  id: string;
  name: string;
  description?: string;
  price: number;
  sku: string;
  images?: string[];
  stock?: number;
  category?: string;
  brand?: string;
  attributes?: any;
  variations?: any[];
}

// Pricing API Types
export interface PricingTier {
  minQty: number;
  maxQty?: number;
  unitPrice: number;
  discount: number;
  discountPercent: number;
  groups?: string[];
}

export interface ProductPricingInfo {
  sku: string;
  name: string;
  basePrice: number;
  currency: string;
  tiers: PricingTier[];
  productTiers?: Array<{
    minQuantity: number;
    maxQuantity?: number;
    price?: number;
    discountPercent?: number;
    groups?: string[];
  }>;
  customerGroups?: string[];
  groupBenefits?: {
    discountPercent?: number;
    freeShipping?: boolean;
    freeShippingMinimum?: number;
  };
  autoDiscounts?: Array<{
    name: string;
    type: string;
    value: number;
    applyTo: string;
  }>;
  freeShipping?: boolean;
}

export interface PriceCalculation {
  originalPrice: number;
  finalPrice: number;
  unitPrice: number;
  totalPrice: number;
  discount: number;
  discountPercent: number;
  appliedRule?: string;
  appliedRuleType?: string;
  tier?: PricingTier;
  quantity: number;
  currency: string;
  appliedDiscounts?: Array<{ name: string; type: string; value: number }>;
  groupBenefitsDiscount?: number;
  freeShipping?: boolean;
}

export interface CartPriceCalculation {
  cartId?: string;
  items: Array<PriceCalculation & { sku: string }>;
  subtotal: number;
  totalDiscount: number;
}

// Shipping API Types
export interface ShippingAddress {
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ShippingCalculation {
  type: string;
  cost: number;
  customerPrice: number;
  markup: number;
  currency: string;
  message?: string;
  breakdown?: {
    baseCost: number;
    markup: number;
    itemCount: number;
  };
}

export interface ShippingRate {
  carrier: string;
  service: string;
  rate: string;
  currency: string;
  delivery_days?: number;
  delivery_date?: string;
}

export interface ShipmentTracking {
  tracking_code: string;
  status: string;
  carrier: string;
  tracking_details: Array<{
    message: string;
    datetime: string;
    source: string;
    status: string;
    tracking_location?: {
      city: string;
      state: string;
      country: string;
    };
  }>;
  est_delivery_date?: string;
}

export interface OrderShippingStatus {
  orderNumber: string;
  overallStatus: string;
  shipped: Array<{
    sku: string;
    name: string;
    quantity: number;
    trackingNumber: string;
    carrier: string;
    status: string;
    shipDate: string;
  }>;
  pending: Array<{
    sku: string;
    name: string;
    orderedQuantity: number;
    shippedQuantity: number;
    pendingQuantity: number;
  }>;
  shipments: Array<{
    id: string;
    tracking: string;
    carrier: string;
    status: string;
    shipDate: string;
  }>;
}

// Discount/Promotion API Types
export interface Promotion {
  name: string;
  description?: string;
  type: 'percentage' | 'amount' | 'fixed_price' | 'buy_x_get_y' | 'free_shipping';
  value?: number;
  autoApply: boolean;
  conditions?: {
    isFirstOrder?: boolean;
    minOrderCount?: number;
    minAccountAgeDays?: number;
    customerGroups?: string[];
    minCartValue?: number;
    minCartQuantity?: number;
    requiredProducts?: string[];
  };
  buyQty?: number;
  getQty?: number;
  getDiscount?: number;
  applyTo?: string;
  products?: string[];
}

export interface CouponValidation {
  valid: boolean;
  discount?: {
    name: string;
    type: string;
    value: number;
    minCartValue?: number;
    maxUses?: number;
    usesRemaining?: number;
    expiresAt?: string;
  };
  estimatedSavings?: number;
  error?: string;
  message?: string;
}

export interface AppliedCoupon {
  success: boolean;
  discount?: {
    name: string;
    code: string;
    type: string;
    value: number;
    appliedAmount: number;
  };
  cart?: {
    subtotal: number;
    discount: number;
    total: number;
  };
  error?: string;
  message?: string;
}

// Customer/Group Types
export interface CustomerGroup {
  id: string;
  name: string;
  description?: string;
}

export interface GroupBenefits {
  name: string;
  status: 'active' | 'inactive';
  customerGroups: string[];
  discountPercent?: number;
  freeShipping?: boolean;
  freeShippingMinimum?: number;
  shippingDiscount?: number;
  earlyAccess?: boolean;
  prioritySupport?: boolean;
  exclusiveProducts?: boolean;
  bonusPointsMultiplier?: number;
  extendedReturns?: number;
  netPaymentTerms?: number;
  badgeText?: string;
  badgeColor?: string;
}

export interface ProductSearchParams {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: 'price' | 'name' | 'date' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderCreateData {
  customerInfo: {
    name: string;
    email: string;
    phone?: string;
  };
  shippingAddress: AddressData;
  billingAddress?: AddressData;
  items: CartItem[];
  paymentMethod: string;
  paymentGateway: string;
  paymentIntentId?: string;
  transactionId?: string;
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  discountCode?: string;
  total: number;
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

export interface PaymentGatewayConfig {
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
  config: any;
}

class StorefrontAPIService {
  private client = getAppEngineClient();

  // Product Methods
  async getProducts(params?: ProductSearchParams): Promise<Product[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.query) queryParams.append('query', params.query);
      if (params?.category) queryParams.append('category', params.category);
      if (params?.brand) queryParams.append('brand', params.brand);
      if (params?.minPrice) queryParams.append('minPrice', params.minPrice.toString());
      if (params?.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
      if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

      const path = `${appmintEndpoints.products.path}?${queryParams.toString()}`;
      const response = await this.client.processRequest('get', path);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getProduct(sku: string): Promise<Product | null> {
    try {
      const path = `${appmintEndpoints.product.path}/${sku}`;
      const response = await this.client.processRequest('get', path);
      return response?.data || null;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  async searchProducts(searchParams: ProductSearchParams): Promise<Product[]> {
    try {
      const response = await this.client.processRequest('post', appmintEndpoints.product_search.path, searchParams);
      return response?.data || [];
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    try {
      const path = `${appmintEndpoints.product_category.path}/${category}`;
      const response = await this.client.processRequest('get', path);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  }

  async getBrands(): Promise<string[]> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.product_brands.path);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching brands:', error);
      throw error;
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.product_categories.path);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Fetch one `sf_attribute` definition by name.
   *
   * A product only stores `{ name, options }` per attribute — the `type`
   * (`selection` / `text` / `file`) and the file config (`multiple`, `accept`,
   * `maxFiles`) live on the attribute record, so the product page has to
   * resolve them before it can render the right input.
   *
   * Always call this WITH a name: `storefront/attributes` with no name falls
   * back to listing brands (legacy behaviour on the server).
   */
  async getAttributeDefinition(name: string): Promise<any | null> {
    if (!name) return null;
    try {
      const path = `${API_ENDPOINTS.STORE_GET_ATTRIBUTES}/${encodeURIComponent(name)}`;
      const response = await this.client.processRequest('get', path);
      const records = response?.data?.data || response?.data || [];
      const record = Array.isArray(records) ? records[0] : records;
      return record?.data || record || null;
    } catch (error) {
      console.error(`Error fetching attribute definition "${name}":`, error);
      return null;
    }
  }

  /** Resolve several attribute definitions at once, keyed by name. */
  async getAttributeDefinitions(names: string[]): Promise<Record<string, any>> {
    const unique = Array.from(new Set((names || []).filter(Boolean)));
    const defs: Record<string, any> = {};

    const records = await Promise.all(unique.map((name) => this.getAttributeDefinition(name)));
    unique.forEach((name, index) => {
      if (records[index]) defs[name] = records[index];
    });

    return defs;
  }

  async getCollections(): Promise<any[]> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.product_collections.path);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching collections:', error);
      throw error;
    }
  }

  // Order Methods
  async createOrder(orderData: OrderCreateData): Promise<any> {
    try {
      const orderPayload: any = {
        customerInfo: orderData.customerInfo,
        shippingAddress: orderData.shippingAddress,
        billingAddress: orderData.billingAddress || orderData.shippingAddress,
        items: orderData.items.map((item) => ({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          image: item.image,
          attributes: item.attributes,
        })),
        paymentMethod: orderData.paymentMethod,
        paymentGateway: orderData.paymentGateway,
        subtotal: orderData.subtotal,
        tax: orderData.tax || 0,
        shipping: orderData.shipping || 0,
        discount: orderData.discount || 0,
        discountCode: orderData.discountCode,
        total: orderData.total,
        status: 'new',
      };

      // Attach affiliate code from cookie if present
      if (typeof window !== 'undefined') {
        const { getAffiliateCode } = await import('@/modules/store/lib/affiliate-tracking');
        const affiliateCode = getAffiliateCode();
        if (affiliateCode) {
          orderPayload.affiliateCode = affiliateCode;
        }
      }

      const response = await this.client.processRequest('post', 'storefront/order/create', orderPayload);
      return response?.data;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  async getOrderByEmail(email: string, orderNumber: string): Promise<any> {
    try {
      const path = `${appmintEndpoints.order_email.path}/${email}/${orderNumber}`;
      const response = await this.client.processRequest('get', path);
      return response?.data;
    } catch (error) {
      console.error('Error fetching order by email:', error);
      throw error;
    }
  }

  async getOrders(customerId?: string): Promise<any[]> {
    try {
      const path = customerId ? `${appmintEndpoints.orders.path}/${customerId}` : appmintEndpoints.orders.path;
      const response = await this.client.processRequest('get', path);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }
  }

  // Payment Gateway Methods
  async getPaymentGateways(): Promise<PaymentGatewayConfig[]> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.checkout_payment_gateways.path, null, null, null);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching payment gateways:', error);
      throw error;
    }
  }

  // Tenant Configuration Methods
  async getTenantConfig(): Promise<any> {
    try {
      const response = await this.client.processRequest('get', 'storefront/config');
      return response?.data || {};
    } catch (error) {
      console.error('Error fetching tenant config:', error);
      return {};
    }
  }

  // Coupon Methods
  async applyCoupon(couponCode: string, cartTotal: number): Promise<any> {
    try {
      const response = await this.client.processRequest('post', appmintEndpoints.checkout_apply_coupon.path, {
        couponCode,
        cartTotal,
      });
      return response?.data;
    } catch (error) {
      console.error('Error applying coupon:', error);
      throw error;
    }
  }

  async submitCheckoutOrder(orderData: any): Promise<any> {
    try {
      // Attach affiliate code from cookie if present
      if (typeof window !== 'undefined') {
        const { getAffiliateCode } = await import('@/modules/store/lib/affiliate-tracking');
        const affiliateCode = getAffiliateCode();
        if (affiliateCode) {
          orderData.affiliateCode = affiliateCode;
        }
      }
      const response = await this.client.processRequest('post', `${API_ENDPOINTS.STORE_CHECKOUT_CART}`, orderData);
      return response?.data;
    } catch (error) {
      console.error('Error submitting checkout order:', error);
      throw error;
    }
  }

  // Serialize writes so a slow earlier selection cannot overwrite a later one.
  private cartSaveQueue: Promise<unknown> = Promise.resolve();

  async persistPricedCart(pricing: CartPriceCalculation): Promise<void> {
    if (!pricing.cartId) throw new Error('The priced cart has no identifier');
    const customer = getCustomerContext();
    const payload = {
      datatype: 'sf_cart',
      data: { ...pricing, email: customer.email, source: 'website' },
    };
    const write = this.cartSaveQueue.catch(() => undefined).then(async () => {
      await this.client.processRequest('post', `storefront/cart/update/${encodeURIComponent(pricing.cartId!)}`, payload);
    });
    this.cartSaveQueue = write;
    await write;
  }

  async getSavedCart(): Promise<any> {
    const response = await this.client.processRequest('get', 'storefront/cart/mine');
    return response ?? null;
  }

  // Cart Methods (Server-side cart management)
  async saveCart(cartItems: CartItem[]): Promise<any> {
    try {
      const response = await this.client.processRequest('post', 'storefront/cart/save', {
        items: cartItems,
      });
      return response?.data;
    } catch (error) {
      console.error('Error saving cart:', error);
      throw error;
    }
  }

  async getCart(cartId: string): Promise<CartItem[]> {
    try {
      const path = `storefront/cart/get/${cartId}`;
      const response = await this.client.processRequest('get', path);
      return response?.data?.items || [];
    } catch (error) {
      console.error('Error fetching cart:', error);
      throw error;
    }
  }

  // ==========================================
  // PRICING API METHODS
  // ==========================================

  /**
   * Calculate price for a single product based on quantity and customer context
   */
  async calculatePrice(sku: string, quantity: number): Promise<PriceCalculation> {
    try {
      const customerContext = getCustomerContext();
      const payload = {
        sku,
        quantity,
        ...customerContext,
      };
      console.log('[StorefrontAPI] calculatePrice REQUEST:', {
        endpoint: 'POST storefront/pricing/calculate',
        payload,
      });
      const response = await this.client.processRequest('post', 'storefront/pricing/calculate', payload);
      console.log('[StorefrontAPI] calculatePrice RESPONSE:', response);
      return response?.data || response;
    } catch (error) {
      console.error('[StorefrontAPI] calculatePrice ERROR:', error);
      throw error;
    }
  }

  /**
   * Calculate prices for all cart items with all applicable discounts
   * Accepts productItems and rentalItems separately per SDK sf-cart schema
   */
  async calculateCartPrices(cart: {
    productItems: any[];
    rentalItems: any[];
    cartId?: string;
    couponCode?: string;
    shippingAddress?: any;
  }): Promise<CartPriceCalculation> {
    try {
      const customerContext = getCustomerContext();
      // The coupon and the destination have to travel with the cart: the
      // server nets the discount off and resolves shipping in the same pass,
      // and it is the only place those numbers are allowed to be decided.
      const payload = {
        productItems: cart.productItems,
        rentalItems: cart.rentalItems,
        cartId: cart.cartId,
        couponCode: cart.couponCode,
        shippingAddress: cart.shippingAddress,
        ...customerContext,
      };
      console.log('[StorefrontAPI] calculateCartPrices REQUEST:', {
        endpoint: 'POST storefront/pricing/calculate-cart',
        payload,
      });
      const response = await this.client.processRequest('post', 'storefront/pricing/calculate-cart', payload);
      console.log('[StorefrontAPI] calculateCartPrices RESPONSE:', response);
      return response?.data || response;
    } catch (error) {
      console.error('[StorefrontAPI] calculateCartPrices ERROR:', error);
      throw error;
    }
  }

  /**
   * Get pricing tiers and discount info for product page display
   */
  async getProductPricing(sku: string): Promise<ProductPricingInfo> {
    try {
      const customerContext = getCustomerContext();
      // Build URL with customer context as query params for GET request
      const params = new URLSearchParams();
      if (customerContext.customerId) params.append('customerId', customerContext.customerId);
      if (customerContext.customerGroups?.length) params.append('customerGroups', customerContext.customerGroups.join(','));
      if (customerContext.tier) params.append('tier', customerContext.tier);

      const url = params.toString() ? `storefront/pricing/product/${sku}?${params.toString()}` : `storefront/pricing/product/${sku}`;

      console.log('[StorefrontAPI] getProductPricing REQUEST:', {
        endpoint: `GET ${url}`,
        customerContext,
      });
      const response = await this.client.processRequest('get', url);
      console.log('[StorefrontAPI] getProductPricing RESPONSE:', response);
      return response?.data;
    } catch (error) {
      console.error('[StorefrontAPI] getProductPricing ERROR:', error);
      throw error;
    }
  }

  // ==========================================
  // SHIPPING API METHODS
  // ==========================================

  /**
   * Calculate shipping cost for cart items based on destination
   */
  async calculateShipping(
    items: Array<{ sku: string; quantity: number }>,
    toAddress: ShippingAddress,
    orderTotal?: number,
  ): Promise<ShippingCalculation> {
    try {
      const customerContext = getCustomerContext();
      const response = await this.client.processRequest('post', 'shipping/calculate', {
        items,
        toAddress,
        orderTotal,
        ...customerContext,
      });
      // Handle both nested and flat response structures
      return response?.data || response;
    } catch (error) {
      console.error('Error calculating shipping:', error);
      throw error;
    }
  }

  /**
   * Get shipping cost for a single product
   */
  async getProductShippingCost(sku: string, quantity: number, toAddress: Partial<ShippingAddress>): Promise<ShippingCalculation> {
    try {
      const response = await this.client.processRequest('post', 'shipping/product-cost', {
        sku,
        quantity,
        toAddress,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching product shipping cost:', error);
      throw error;
    }
  }

  /**
   * Get real-time carrier rates
   */
  async getShippingRates(
    fromAddress: ShippingAddress,
    toAddress: ShippingAddress,
    parcels: Array<{ length: number; width: number; height: number; weight: number }>,
  ): Promise<{ rates: ShippingRate[]; fromAddress: ShippingAddress; toAddress: ShippingAddress }> {
    try {
      const response = await this.client.processRequest('post', 'shipping/rates', {
        fromAddress,
        toAddress,
        parcels,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching shipping rates:', error);
      throw error;
    }
  }

  /**
   * Track a shipment by tracking number
   */
  async trackShipment(trackingNumber: string): Promise<ShipmentTracking> {
    try {
      const response = await this.client.processRequest('get', `shipping/track/${trackingNumber}`);
      return response?.data || response;
    } catch (error) {
      console.error('Error tracking shipment:', error);
      throw error;
    }
  }

  /**
   * Get complete shipping status for an order
   */
  async getOrderShippingStatus(orderNumber: string, email?: string): Promise<OrderShippingStatus> {
    try {
      // The server's route is GET shipping/order/status/:orderNumber (this used to call
      // shipping/order/:n/status, which never existed). A guest proves the order is theirs
      // with the email on it; a signed-in customer is matched on their own email.
      const query = email ? `?email=${encodeURIComponent(email.trim())}` : '';
      const response = await this.client.processRequest('get', `shipping/order/status/${encodeURIComponent(orderNumber.trim())}${query}`);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching order shipping status:', error);
      throw error;
    }
  }

  /**
   * Verify and standardize a shipping address
   */
  async verifyAddress(address: ShippingAddress): Promise<{
    original: ShippingAddress;
    verified: ShippingAddress;
    isValid: boolean;
  }> {
    try {
      const response = await this.client.processRequest('post', 'shipping/verify-address', {
        address,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error verifying address:', error);
      throw error;
    }
  }

  /**
   * Get available shipping methods
   */
  async getShippingMethods(): Promise<{
    carriers: string[];
    methods: Array<{ code: string; name: string; description: string }>;
  }> {
    try {
      const response = await this.client.processRequest('get', 'shipping/methods');
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching shipping methods:', error);
      throw error;
    }
  }

  // ==========================================
  // DISCOUNTS & PROMOTIONS API METHODS
  // ==========================================

  /**
   * Get active promotions for display
   * GET /storefront/discounts/promotions/active
   */
  async getPromotions(): Promise<{ promotions: Promotion[] }> {
    try {
      const response = await this.client.processRequest('get', 'storefront/discounts/promotions/active');
      return { promotions: response?.data || response || [] };
    } catch (error) {
      console.error('Error fetching promotions:', error);
      return { promotions: [] };
    }
  }

  /**
   * Get featured promotions for homepage
   * GET /storefront/discounts/promotions/featured
   */
  async getFeaturedPromotions(limit?: number): Promise<Promotion[]> {
    try {
      const path = limit ? `storefront/discounts/promotions/featured?limit=${limit}` : 'storefront/discounts/promotions/featured';
      const response = await this.client.processRequest('get', path);
      return response?.data || response || [];
    } catch (error) {
      console.error('Error fetching featured promotions:', error);
      return [];
    }
  }

  /**
   * Get automatic discounts that apply to cart
   * POST /storefront/discounts/automatic
   */
  async getAutomaticDiscounts(subtotal: number, items: Array<{ sku: string; quantity: number; price: number; categoryId?: string }>): Promise<any> {
    try {
      const customerContext = getCustomerContext();
      const response = await this.client.processRequest('post', 'storefront/discounts/automatic', {
        subtotal,
        items,
        ...customerContext,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching automatic discounts:', error);
      return { discounts: [] };
    }
  }

  /**
   * Validate discount code
   * POST /storefront/discounts/validate
   */
  async validateCoupon(
    code: string,
    subtotal: number,
    cart: { productItems: any[]; rentalItems: any[]; cartId?: string },
    userInfo?: { email?: string; phone?: string },
  ): Promise<CouponValidation> {
    try {
      const customerContext = getCustomerContext();
      const response = await this.client.processRequest('post', 'storefront/discounts/validate', {
        code,
        subtotal,
        productItems: cart.productItems,
        rentalItems: cart.rentalItems,
        cartId: cart.cartId,
        ...customerContext,
        ...(userInfo?.email && { email: userInfo.email }),
        ...(userInfo?.phone && { phone: userInfo.phone }),
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error validating coupon:', error);
      throw error;
    }
  }

  /**
   * Apply a coupon code and get cart summary with discount
   * POST /storefront/discounts/apply
   */
  async applyCartCoupon(params: {
    productItems: any[];
    rentalItems: any[];
    cartId?: string;
    couponCode: string;
    email?: string;
    phone?: string;
  }): Promise<{
    valid: boolean;
    reason?: string;
    subtotal: number;
    shipping: number;
    tax: number;
    discount: number;
    total: number;
    cartId?: string;
    discounts: Array<{
      code?: string;
      name: string;
      amount: number;
      type: string;
      message?: string;
    }>;
  }> {
    try {
      const customerContext = getCustomerContext();
      const response = await this.client.processRequest('post', 'storefront/discounts/apply', {
        productItems: params.productItems,
        rentalItems: params.rentalItems,
        cartId: params.cartId,
        couponCode: params.couponCode,
        ...customerContext,
        ...(params.email && { email: params.email }),
        ...(params.phone && { phone: params.phone }),
      });
      console.log('[StorefrontAPI] applyCartCoupon RESPONSE:', response);
      return response?.data || response;
    } catch (error) {
      console.error('[StorefrontAPI] applyCartCoupon ERROR:', error);
      throw error;
    }
  }

  /**
   * Calculate full cart summary with all discounts applied
   * This is the single source of truth for cart pricing
   * POST /storefront/discounts/calculate
   */
  async calculateCartSummary(params: {
    /** Cards applied at checkout. The server says what each would cover; nothing is spent. */
    giftCards?: { code: string; pin?: string }[];
    /** Store credit / reward points a signed-in shopper chose to use. The server says what they cover; nothing is spent. */
    wallet?: CheckoutWalletChoice;
    productItems: any[];
    rentalItems: any[];
    cartId?: string;
    couponCode?: string;
    email?: string;
    phone?: string;
    shippingAddress?: AddressData;
    billingAddress?: AddressData;
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
  }): Promise<any> {
    try {
      const customerContext = getCustomerContext();
      const response = await this.client.processRequest('post', 'storefront/discounts/calculate', {
        productItems: params.productItems,
        rentalItems: params.rentalItems,
        cartId: params.cartId,
        couponCode: params.couponCode,
        email: params.email,
        phone: params.phone,
        shippingAddress: params.shippingAddress,
        billingAddress: params.billingAddress,
        rentalFulfillment: params.rentalFulfillment,
        giftCards: params.giftCards?.length ? params.giftCards : undefined,
        wallet: params.wallet && (params.wallet.storeCredit !== undefined || params.wallet.points !== undefined) ? params.wallet : undefined,
        ...customerContext,
      });
      console.log('[StorefrontAPI] calculateCartSummary RESPONSE:', response);
      return response?.data || response;
    } catch (error) {
      console.error('[StorefrontAPI] calculateCartSummary ERROR:', error);
      throw error;
    }
  }

  /**
   * Get promotion price for a product
   * POST /storefront/discounts/promotions/price
   */
  async getProductDiscountPrice(
    sku: string,
    originalPrice: number,
    quantity?: number,
  ): Promise<{ finalPrice: number; discount: number; promotionName?: string }> {
    try {
      const response = await this.client.processRequest('post', 'storefront/discounts/promotions/price', {
        sku,
        originalPrice,
        quantity,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching product discount price:', error);
      return { finalPrice: originalPrice, discount: 0 };
    }
  }

  // ==========================================
  // TAX API METHODS
  // ==========================================

  /**
   * Calculate tax for cart items
   * POST /storefront/tax/calculate
   */
  async calculateTax(
    items: Array<{ sku: string; quantity: number; price: number }>,
    shippingAddress: {
      country: string;
      state: string;
      city?: string;
      zip?: string;
    },
    subtotal: number,
    shippingCost?: number,
  ): Promise<{
    taxAmount: number;
    taxRate: number;
    taxBreakdown?: Array<{ type: string; rate: number; amount: number }>;
    taxExempt?: boolean;
  }> {
    try {
      const response = await this.client.processRequest('post', 'storefront/tax/calculate', {
        items,
        shippingAddress,
        subtotal,
        shippingCost: shippingCost || 0,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error calculating tax:', error);
      // Return zero tax on error
      return { taxAmount: 0, taxRate: 0 };
    }
  }

  /**
   * Get tax rate for a location
   * POST /storefront/tax/rate
   */
  async getTaxRate(location: { country: string; state: string; city?: string; zip?: string }): Promise<{
    taxRate: number;
    taxName?: string;
    breakdown?: Array<{ type: string; rate: number }>;
  }> {
    try {
      const response = await this.client.processRequest('post', 'storefront/tax/rate', location);
      return response?.data || response;
    } catch (error) {
      console.error('Error getting tax rate:', error);
      return { taxRate: 0 };
    }
  }

  /**
   * Check if customer is tax exempt
   * POST /storefront/tax/check-exempt
   */
  async checkTaxExempt(
    customerId: string,
    exemptionNumber?: string,
  ): Promise<{
    exempt: boolean;
    exemptionType?: string;
    expiresAt?: string;
  }> {
    try {
      const response = await this.client.processRequest('post', 'storefront/tax/check-exempt', {
        customerId,
        exemptionNumber,
      });
      return response?.data || response;
    } catch (error) {
      console.error('Error checking tax exemption:', error);
      return { exempt: false };
    }
  }

  // ==========================================
  // CUSTOMER & GROUP BENEFITS API METHODS
  // ==========================================

  /**
   * Get customer's groups and benefits
   */
  getCustomerFromSession(): {
    customerId?: string;
    email?: string;
    customerGroups: string[];
    tier?: string;
    benefits?: {
      discountPercent: number;
      freeShipping: boolean;
      freeShippingMinimum?: number;
      earlyAccess: boolean;
      prioritySupport: boolean;
      bonusPointsMultiplier: number;
    };
  } | null {
    const context = getCustomerContext();
    if (!context.customerId) return null;

    const user = activeSession.getUser();
    if (!user) return null;

    return {
      customerId: context.customerId,
      email: context.email,
      customerGroups: context.customerGroups || [],
      tier: context.tier || user.tier || user.customerTier,
      benefits: user.benefits ||
        user.customerBenefits || {
          discountPercent: user.discountPercent || 0,
          freeShipping: user.freeShipping || false,
          freeShippingMinimum: user.freeShippingMinimum,
          earlyAccess: user.earlyAccess || false,
          prioritySupport: user.prioritySupport || false,
          bonusPointsMultiplier: user.bonusPointsMultiplier || 1,
        },
    };
  }

  // ==========================================
  // CUSTOMER BENEFITS & ENROLLMENT API METHODS
  // ==========================================

  /**
   * Get customer benefits - absolute benefits (from groups + direct), enrollments, and available benefits
   * GET /client-data/benefits
   */
  async getCustomerBenefits(): Promise<{
    customerId: string;
    customerGroups: string[];
    directBenefits: string[];
    benefits: Array<{
      name: string;
      title?: string;
      description?: string;
      perks?: {
        discount?: number;
        discountType?: string;
        freeShipping?: boolean;
        freeShippingMinimum?: number;
        earlyAccess?: boolean;
        prioritySupport?: boolean;
        shippingDiscount?: number;
      };
      display?: {
        color?: string;
        icon?: string;
        badgeText?: string;
        showBadge?: boolean;
      };
      source: 'group' | 'direct';
    }>;
    enrollments: {
      pending: Array<{
        sk: string;
        data: {
          number?: string;
          benefit: string;
          status: string;
          customer?: { id?: string; name?: string; email?: string; phone?: string };
          applicationForm?: string;
          formSubmissionId?: string;
          formData?: Record<string, any>;
          documents?: Array<{ name: string; url: string; uploadedAt?: string }>;
          submittedAt?: string;
          submittedBy?: string;
          notes?: string;
          agreement?: { text?: string; acceptedAt?: string; acceptedBy?: string };
        };
      }>;
      active: Array<{
        sk: string;
        data: {
          number?: string;
          benefit: string;
          status: string;
          activatedAt?: string;
          expiresAt?: string;
          approvedAt?: string;
          agreement?: { text?: string; acceptedAt?: string; acceptedBy?: string };
        };
      }>;
      rejected: Array<{
        sk: string;
        data: {
          number?: string;
          benefit: string;
          status: string;
          rejectedAt?: string;
          rejectionReason?: string;
          reviewNotes?: string;
        };
      }>;
    };
    availableBenefits: Array<{
      // Full BenefitModel from SDK
      name: string;
      title?: string;
      status?: 'active' | 'inactive';
      description?: string;
      applicationForm?: string;
      applicationFormData?: any;
      requiresApproval?: boolean;
      information?: string;
      legalAgreement?: string;
      customerGroups?: string[];
      perks?: {
        discount?: number;
        discountType?: 'percentage' | 'fixed';
        earlyAccess?: boolean;
        prioritySupport?: boolean;
        freeShipping?: boolean;
        freeShippingMinimum?: number;
        shippingDiscount?: number;
        exclusiveProducts?: string[];
      };
      color?: string;
      icon?: string;
      showBadge?: boolean;
      badgeText?: string;
      validityPeriod?: {
        duration?: number;
        unit?: 'days' | 'months' | 'years' | 'unlimited';
        renewable?: boolean;
      };
    }>;
  } | null> {
    try {
      const response = await this.client.processRequest('get', 'client-data/benefits');
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching customer benefits:', error);
      return null;
    }
  }

  /**
   * Get customer profile with addresses
   * GET /client-data/profile
   * Returns profile with addresses using SDK AddressSchema fields
   */
  async getCustomerProfile(): Promise<{
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
    addresses?: Array<AddressData & { id: string; label?: string; isDefault?: boolean; type?: 'billing' | 'shipping' | 'both' }>;
  } | null> {
    try {
      const response = await this.client.processRequest('get', 'client-data/profile');
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching customer profile:', error);
      return null;
    }
  }

  /**
   * The signed-in customer's forms — submitted, and still waiting on them.
   * GET /client-data/forms
   *
   * Matched server-side on the address the form gate settled on, so a form
   * filled in from an emailed link belongs to the same person who is signed in
   * here without either side having to claim it.
   */
  async getMyForms(options?: { page?: number; limit?: number; status?: string }): Promise<{
    data: Array<{
      id: string;
      status: string;
      submittedAt?: string | null;
      requestedAt?: string | null;
      expiresAt?: string | null;
      values: Record<string, any>;
      form: { name: string; title?: string; description?: string; schema?: any } | null;
      authentication: { method: string; verified: boolean; admittedBy?: string | null };
    }>;
    total: number;
  }> {
    try {
      const query = new URLSearchParams();
      if (options?.page) query.set('page', String(options.page));
      if (options?.limit) query.set('limit', String(options.limit));
      if (options?.status) query.set('status', options.status);
      const path = `client-data/forms${query.size ? `?${query.toString()}` : ''}`;
      const response = await this.client.processRequest('get', path);

      // The body arrives as `{ data, total }` — and `response.data` is then the
      // ROWS, not the body. Unwrapping one level blindly handed back the array
      // and then asked it for `.data`, which is nothing: every customer was
      // told they had no forms while the server was returning them.
      const body = response?.data ?? response;
      const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
      return { data: rows, total: Array.isArray(body) ? rows.length : (body?.total ?? rows.length) };
    } catch (error) {
      console.error('Error fetching customer forms:', error);
      return { data: [], total: 0 };
    }
  }

  /**
   * Get customer's saved addresses
   * GET /client-data/addresses
   * Returns addresses using SDK AddressSchema fields
   * API returns BaseModelDTO with data: BaseModel<Address>[], so we extract inner data
   */
  async getCustomerAddresses(): Promise<Array<AddressData & { id: string; label?: string; isDefault?: boolean; type?: 'billing' | 'shipping' | 'both' }>> {
    try {
      const response = await this.client.processRequest('get', 'client-data/addresses');
      // Response is BaseModelDTO: { data: BaseModel<Address>[] }
      // Each BaseModel has: { pk, sk, name, data: {...address} }
      const items = response?.data || response || [];
      return items.map((item: any) => ({
        id: item.sk || item.id,
        ...item.data,
      }));
    } catch (error) {
      console.error('Error fetching customer addresses:', error);
      return [];
    }
  }

  /**
   * Save a customer address
   * POST /client-data/addresses
   */
  async saveCustomerAddress(address: AddressData & { id?: string; label?: string; isDefault?: boolean; type?: 'billing' | 'shipping' | 'both' }): Promise<{ success?: boolean; id?: string; error?: string }> {
    try {
      const response = await this.client.processRequest('post', 'client-data/addresses', address);
      const result = response?.data || response;
      return result?.sk || result?.id ? { success: true, id: result.sk || result.id } : result;
    } catch (error: any) {
      console.error('Error saving customer address:', error);
      return { success: false, error: getResponseErrorMessage(error, 'Failed to save address') };
    }
  }

  /**
   * Delete a customer address
   * DELETE /client-data/addresses/:id
   */
  async deleteCustomerAddress(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.processRequest('delete', `client-data/addresses/${id}`);
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting customer address:', error);
      return { success: false, error: getResponseErrorMessage(error, 'Failed to delete address') };
    }
  }

  /**
   * Set an address as default
   * PUT /client-data/addresses/:id/default
   */
  async setDefaultAddress(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.processRequest('put', `client-data/addresses/${id}/default`);
      return { success: true };
    } catch (error: any) {
      console.error('Error setting default address:', error);
      return { success: false, error: getResponseErrorMessage(error, 'Failed to set default address') };
    }
  }

  /**
   * Address autocomplete - get suggestions as user types
   * POST /client-data/addresses/autocomplete
   */
  async getAddressAutocomplete(input: string, sessionToken?: string): Promise<Array<{ placeId: string; description: string; mainText: string; secondaryText: string }>> {
    try {
      if (!input || input.length < 3) return [];
      const response = await this.client.processRequest('post', 'client-data/addresses/autocomplete', {
        input,
        sessiontoken: sessionToken,
        components: 'country:us|country:ca',
      });
      const predictions = response?.predictions || response?.data?.predictions || [];
      return predictions.map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
      }));
    } catch (error: any) {
      console.error('Error getting address autocomplete:', error);
      return [];
    }
  }

  /**
   * Get full address details from place ID
   * GET /client-data/addresses/place/:placeId
   * Returns: { placeId, formattedAddress, address: { street1, street2, city, state, zip, country }, location }
   */
  async getPlaceDetails(placeId: string): Promise<AddressData | null> {
    try {
      const response = await this.client.processRequest('get', `client-data/addresses/place/${placeId}`);
      const result = response?.data || response;
      // API returns { address: { street1, city, ... } } - extract the nested address object
      return result?.address || result || null;
    } catch (error: any) {
      console.error('Error getting place details:', error);
      return null;
    }
  }

  /**
   * Enroll in a benefit
   * POST /client-data/benefits/enroll
   */
  async enrollInBenefit(enrollment: {
    benefit: string;
    documents?: Array<{ name: string; url: string }>;
    notes?: string;
    formData?: Record<string, any>;
    agreementAccepted?: boolean;
  }): Promise<{ success?: boolean; sk?: string; error?: string; message?: string }> {
    try {
      const response = await this.client.processRequest('post', 'client-data/benefits/enroll', enrollment);
      const result = response?.data || response;
      return result?.sk ? { success: true, sk: result.sk } : result;
    } catch (error: any) {
      console.error('Error enrolling in benefit:', error);
      return { success: false, error: getResponseErrorMessage(error, 'Failed to submit enrollment') };
    }
  }

  // ---------------------------------------------------------------------------
  // Shared accounts — an agency, department or wholesale account a customer can
  // order on. Which one they are ordering for is held on their token, so these
  // calls change it rather than passing it around.
  // ---------------------------------------------------------------------------

  /**
   * Choose who to order for. Pass no accountId to go back to ordering as
   * yourself. Returns a re-issued token that replaces the current one — prices
   * and carts follow it from the next request on.
   */
  async setSharedAccount(accountId?: string): Promise<{ token?: string; refreshToken?: string; customer?: any; error?: string }> {
    try {
      const response = await this.client.processRequest('post', 'profile/customer/shared-account', { accountId });
      return response?.data || response;
    } catch (error: any) {
      console.error('Error switching shared account:', error);
      return { error: getResponseErrorMessage(error, 'Could not switch account') };
    }
  }

  /** Take up an invitation to join a shared account. Requires being signed in. */
  async acceptSharedAccountInvitation(invitationToken: string): Promise<{ accepted?: boolean; accountId?: string; error?: string }> {
    try {
      const response = await this.client.processRequest('post', `client-data/shared-accounts/invites/accept/${invitationToken}`);
      return response?.data || response;
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      return { error: getResponseErrorMessage(error, 'Could not accept the invitation') };
    }
  }

  /** Managers only: everyone on the account, including suspended members. */
  async getSharedAccountMembers(accountId: string): Promise<Array<{
    associationId: string;
    customerId?: string;
    name?: string;
    email?: string;
    role?: string;
    status?: string;
    missing?: boolean;
  }>> {
    try {
      const response = await this.client.processRequest('get', `client-data/shared-accounts/${accountId}/members`);
      const members = response?.data ?? response;
      return Array.isArray(members) ? members : [];
    } catch (error) {
      console.error('Error fetching account members:', error);
      return [];
    }
  }

  /** Managers only: orders placed on the account by anyone. */
  async getSharedAccountOrders(accountId: string, options?: { page?: number; limit?: number }): Promise<{ data: any[]; total?: number }> {
    try {
      const query = new URLSearchParams();
      if (options?.page) query.set('page', String(options.page));
      if (options?.limit) query.set('limit', String(options.limit));
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const response = await this.client.processRequest('get', `client-data/shared-accounts/${accountId}/orders${suffix}`);
      const result = response?.data || response;
      return { data: result?.data || [], total: result?.total };
    } catch (error) {
      console.error('Error fetching account orders:', error);
      return { data: [] };
    }
  }

  /** Managers only: change a member's role, or suspend them. */
  async updateSharedAccountMember(
    accountId: string,
    associationId: string,
    updates: { role?: 'manager' | 'buyer'; status?: 'active' | 'suspended' },
  ): Promise<{ success?: boolean; error?: string }> {
    try {
      await this.client.processRequest('put', `client-data/shared-accounts/${accountId}/members/${associationId}`, updates);
      return { success: true };
    } catch (error: any) {
      console.error('Error updating member:', error);
      return { success: false, error: getResponseErrorMessage(error, 'Could not update this member') };
    }
  }

  /** Managers only: invite someone onto the account. */
  async inviteToSharedAccount(
    accountId: string,
    invite: { email: string; firstName?: string; lastName?: string; role?: 'manager' | 'buyer'; message?: string },
  ): Promise<{ invited?: boolean; added?: boolean; resent?: boolean; reinstated?: boolean; error?: string }> {
    try {
      const response = await this.client.processRequest('post', `client-data/shared-accounts/${accountId}/invites`, invite);
      return response?.data || response;
    } catch (error: any) {
      console.error('Error inviting to account:', error);
      return { error: getResponseErrorMessage(error, 'Could not send the invitation') };
    }
  }

  /**
   * Get customer's benefit enrollments
   * GET /client-data/benefits/enrollments
   */
  async getBenefitEnrollments(): Promise<{
    data: Array<{
      sk: string;
      data: {
        number: string;
        benefit: string;
        status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'active' | 'expired' | 'cancelled';
        submittedAt?: string;
        approvedAt?: string;
        rejectedAt?: string;
        activatedAt?: string;
        expiresAt?: string;
        notes?: string;
        rejectionReason?: string;
        formData?: Record<string, any>;
      };
    }>;
  }> {
    try {
      const response = await this.client.processRequest('get', 'client-data/benefits/enrollments');
      return response?.data || response || { data: [] };
    } catch (error) {
      console.error('Error fetching benefit enrollments:', error);
      return { data: [] };
    }
  }

  /**
   * Get public benefit info by name (no auth required)
   * This fetches benefit definition from the repository
   * GET /repository/find-by-attribute/:collection/:attribute/:value
   */
  async getPublicBenefitInfo(benefitName: string): Promise<{
    name: string;
    title?: string;
    description?: string;
    perks?: {
      discount?: number;
      discountType?: 'percentage' | 'fixed';
      freeShipping?: boolean;
      freeShippingMinimum?: number;
      earlyAccess?: boolean;
      prioritySupport?: boolean;
      shippingDiscount?: number;
    };
    requiresApproval?: boolean;
    applicationForm?: string;
    applicationFormData?: any;
    display?: {
      color?: string;
      icon?: string;
      badgeText?: string;
      showBadge?: boolean;
    };
  } | null> {
    try {
      // Use repository endpoint to fetch benefit by name (public access)
      const response = await this.client.processRequest(
        'get',
        `repository/find-by-attribute/benefit/name/${encodeURIComponent(benefitName)}`,
        null,
        null, // No auth token - public access
        null,
      );
      const benefit = response?.data || response;
      if (!benefit || (Array.isArray(benefit) && benefit.length === 0)) {
        return null;
      }
      // If array, take first result
      const benefitData = Array.isArray(benefit) ? benefit[0] : benefit;
      return benefitData?.data || benefitData;
    } catch (error) {
      console.error('Error fetching public benefit info:', error);
      return null;
    }
  }
}

export const storefrontAPI = new StorefrontAPIService();

// NOTE: Affiliate methods moved to @/lib/affiliate-api.ts
// NOTE: Finance methods moved to @/lib/finance-api.ts
// NOTE: Event methods moved to @/lib/events-api.ts

/* REMOVED — affiliate, finance, event methods now in separate files */
/*
  async joinAffiliateProgram(body: { name?: string; program?: string; referredBy?: string }): Promise<any> {
    try {
      const response = await this.client.processRequest('post', appmintEndpoints.affiliate_join.path, body);
      return response?.data || response;
    } catch (error) {
      console.error('Error joining affiliate program:', error);
      throw error;
    }
  }

  async getAffiliateProfile(): Promise<{ enrolled: boolean; profile?: any } | null> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.affiliate_me.path);
      const data = response?.data || response;
      if (!data || data.enrolled === false) {
        return { enrolled: false };
      }
      return { enrolled: true, profile: data.affiliate || data };
    } catch (error: any) {
      const status = error?.response?.status || error?.status;
      if (status === 404 || status === 403) {
        return { enrolled: false };
      }
      console.error('Error fetching affiliate profile:', error);
      return { enrolled: false };
    }
  }

  async getAffiliateReferrals(status?: string, page?: number, pageSize?: number): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (page) params.append('page', page.toString());
      if (pageSize) params.append('pageSize', pageSize.toString());
      const query = params.toString();
      const path = query ? `${appmintEndpoints.affiliate_referrals.path}?${query}` : appmintEndpoints.affiliate_referrals.path;
      const response = await this.client.processRequest('get', path);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching affiliate referrals:', error);
      return { referrals: [], total: 0 };
    }
  }

  async getAffiliateEarnings(page?: number, pageSize?: number): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (page) params.append('page', page.toString());
      if (pageSize) params.append('pageSize', pageSize.toString());
      const query = params.toString();
      const path = query ? `${appmintEndpoints.affiliate_earnings.path}?${query}` : appmintEndpoints.affiliate_earnings.path;
      const response = await this.client.processRequest('get', path);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching affiliate earnings:', error);
      return { earnings: [], total: 0, stats: {} };
    }
  }

  // ==========================================
  // AFFILIATE LINK GENERATION
  // ==========================================

  async getAffiliatePrograms(): Promise<any[]> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.affiliate_programs.path);
      return response?.data || response || [];
    } catch (error) {
      console.error('Error fetching affiliate programs:', error);
      return [];
    }
  }

  // ==========================================
  // WALLET & PAYOUT API METHODS
  // ==========================================

  async getWallet(): Promise<any> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.finance_wallet.path);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }
  }

  async getPayouts(status?: string, page?: number, pageSize?: number): Promise<any> {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (page) params.append('page', page.toString());
      if (pageSize) params.append('pageSize', pageSize.toString());
      const query = params.toString();
      const path = query ? `${appmintEndpoints.finance_payouts.path}?${query}` : appmintEndpoints.finance_payouts.path;
      const response = await this.client.processRequest('get', path);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching payouts:', error);
      return { data: [], total: 0 };
    }
  }

  async requestPayout(body: { amount: number; methodId?: string; notes?: string }): Promise<any> {
    try {
      const response = await this.client.processRequest('post', appmintEndpoints.finance_payout_request.path, body);
      return response?.data || response;
    } catch (error) {
      console.error('Error requesting payout:', error);
      throw error;
    }
  }

  async getPayoutMethods(): Promise<any> {
    try {
      const response = await this.client.processRequest('get', appmintEndpoints.finance_payout_methods.path);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching payout methods:', error);
      return [];
    }
  }

  async addPayoutMethod(body: any): Promise<any> {
    try {
      const response = await this.client.processRequest('post', appmintEndpoints.finance_payout_method_add.path, body);
      return response?.data || response;
    } catch (error) {
      console.error('Error adding payout method:', error);
      throw error;
    }
  }

  // ==========================================
  // EVENT API METHODS
  // ==========================================

  async getEvents(params?: { type?: string; fromDate?: string; toDate?: string; limit?: number }): Promise<any> {
    try {
      const qs = new URLSearchParams();
      if (params?.type) qs.append('type', params.type);
      if (params?.fromDate) qs.append('fromDate', params.fromDate);
      if (params?.toDate) qs.append('toDate', params.toDate);
      if (params?.limit) qs.append('limit', params.limit.toString());
      const query = qs.toString();
      const path = query ? `client/events?${query}` : 'client/events';
      const response = await this.client.processRequest('get', path);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  async getEventDetail(eventId: string): Promise<{ event: any; ticketTypes: any[] } | null> {
    try {
      const response = await this.client.processRequest('get', `client/events/${eventId}`);
      const data = response?.data || response;
      // API returns { event, ticketTypes }
      if (data?.event) return data;
      // Fallback if response IS the event
      return { event: data, ticketTypes: data?.ticketTypes || [] };
    } catch (error) {
      console.error('Error fetching event detail:', error);
      return null;
    }
  }

  async getEventTicketTypes(eventId: string): Promise<any[]> {
    try {
      const response = await this.client.processRequest('get', `client/events/${eventId}/ticket-types`);
      return response?.data || response || [];
    } catch (error) {
      console.error('Error fetching ticket types:', error);
      return [];
    }
  }

  async getEventSessions(eventId: string, params?: { day?: string; track?: string }): Promise<any[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.day) qs.append('day', params.day);
      if (params?.track) qs.append('track', params.track);
      const query = qs.toString();
      const path = query ? `client/events/${eventId}/sessions?${query}` : `client/events/${eventId}/sessions`;
      const response = await this.client.processRequest('get', path);
      return response?.data || response || [];
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  }

  async getEventSchedule(eventId: string): Promise<any> {
    try {
      const response = await this.client.processRequest('get', `client/events/${eventId}/schedule`);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching schedule:', error);
      return null;
    }
  }

  async getEventParticipants(eventId: string, params?: { type?: string; role?: string }): Promise<any[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.type) qs.append('type', params.type);
      if (params?.role) qs.append('role', params.role);
      const query = qs.toString();
      const path = query ? `client/events/${eventId}/participants?${query}` : `client/events/${eventId}/participants`;
      const response = await this.client.processRequest('get', path);
      return response?.data || response || [];
    } catch (error) {
      console.error('Error fetching participants:', error);
      return [];
    }
  }

  async purchaseEventTickets(body: {
    eventId: string;
    email: string;
    name: string;
    items: { ticketTypeId: string; quantity: number }[];
    paymentMethod?: string;
  }): Promise<{ booking: any; tickets: any[] }> {
    try {
      const response = await this.client.processRequest('post', 'client/events/tickets/purchase', body);
      const data = response?.data || response;
      // API returns { booking, tickets }
      return data;
    } catch (error) {
      console.error('Error purchasing tickets:', error);
      throw error;
    }
  }

  async createEventStripeIntent(body: { email?: string; amount: number; currency?: string; referenceId: string }): Promise<any> {
    try {
      const response = await this.client.processRequest('post', 'client/events/stripe/intent', body);
      return response?.data || response;
    } catch (error) {
      console.error('Error creating event stripe intent:', error);
      throw error;
    }
  }

  async createEventStripeCheckoutSession(body: any): Promise<any> {
    try {
      const response = await this.client.processRequest('post', 'client/events/stripe/checkout-session', body);
      return response?.data || response;
    } catch (error) {
      console.error('Error creating event stripe checkout session:', error);
      throw error;
    }
  }

  async confirmEventOrder(body: { bookingId: string; paymentRef: string; paymentGateway: string }): Promise<{ booking: any; tickets: any[] }> {
    try {
      const response = await this.client.processRequest('post', 'client/events/tickets/confirm-order', body);
      const data = response?.data || response;
      // API returns { booking, tickets }
      return data;
    } catch (error) {
      console.error('Error confirming order:', error);
      throw error;
    }
  }

  async getMyEventTickets(eventId?: string): Promise<any[]> {
    try {
      const path = eventId ? `client/events/tickets/mine?eventId=${eventId}` : 'client/events/tickets/mine';
      const response = await this.client.processRequest('get', path);
      return response?.data || response || [];
    } catch (error) {
      console.error('Error fetching my tickets:', error);
      return [];
    }
  }

  async getEventBooking(email: string, bookingId: string): Promise<{ booking: any; tickets: any[] } | null> {
    try {
      const response = await this.client.processRequest('get', `client/events/booking?email=${encodeURIComponent(email)}&bookingId=${encodeURIComponent(bookingId)}`);
      const data = response?.data || response;
      // API returns { booking, tickets }
      return data;
    } catch (error) {
      console.error('Error fetching booking:', error);
      return null;
    }
  }

  async getEventTicketDetail(ticketId: string): Promise<any> {
    try {
      const response = await this.client.processRequest('get', `client/events/tickets/${ticketId}`);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching ticket detail:', error);
      return null;
    }
  }

  async getEventTicketQR(ticketId: string): Promise<any> {
    try {
      const response = await this.client.processRequest('get', `client/events/tickets/${ticketId}/qr`);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching ticket QR:', error);
      return null;
    }
  }

  async transferEventTicket(ticketId: string, body: { email: string; name?: string }): Promise<any> {
    try {
      const response = await this.client.processRequest('post', `client/events/tickets/${ticketId}/transfer`, body);
      return response?.data || response;
    } catch (error) {
      console.error('Error transferring ticket:', error);
      throw error;
    }
  }

  async getEventTicketPerks(ticketId: string): Promise<any> {
    try {
      const response = await this.client.processRequest('get', `client/events/tickets/${ticketId}/perks`);
      return response?.data || response;
    } catch (error) {
      console.error('Error fetching ticket perks:', error);
      return null;
    }
  }

  async getMyEventParticipation(eventId?: string): Promise<any[]> {
    try {
      const path = eventId ? `client/events/participation/mine?eventId=${eventId}` : 'client/events/participation/mine';
      const response = await this.client.processRequest('get', path);
      return response?.data || response || [];
    } catch (error) {
      console.error('Error fetching participation:', error);
      return [];
    }
  }

  async respondToEventInvite(participantId: string, response: 'accepted' | 'declined' | 'tentative'): Promise<any> {
    try {
      const res = await this.client.processRequest('put', `client/events/participation/${participantId}/respond`, { response });
      return res?.data || res;
    } catch (error) {
      console.error('Error responding to invite:', error);
      throw error;
    }
  }
*/
