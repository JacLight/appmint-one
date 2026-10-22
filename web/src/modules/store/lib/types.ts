/** Shapes the Store screens read from appengine storefront (client-safe). */

export interface ProductOption { label: string; value: string; price?: string | number; color?: string; image?: string }
export interface ProductAttribute {
  name: string;
  title?: string;
  type?: string;          // "selection" | "text"
  display?: string;       // "radio" | "checkbox" | "color" | "select"
  required?: boolean;
  multiple?: boolean;
  maxValue?: number;
  options?: ProductOption[];
}

export interface ProductData {
  sku: string;
  name: string;
  title?: string;
  slug?: string;
  price: number;
  currency?: string;
  description?: string;
  status?: string;
  hide?: boolean;
  brand?: string;
  image?: string;
  images?: { url: string; path?: string }[];
  attributes?: ProductAttribute[];
  badge?: string;
  rating?: number;
  reviewCount?: number;
  details?: string[];
  category?: string;
  section?: string;
  popular?: boolean;
  restaurant?: string;
  giftCard?: { enabled?: boolean; denominations?: number[]; allowCustomAmount?: boolean; minAmount?: number; maxAmount?: number };
  calculatedPrice?: { originalPrice?: number; finalPrice?: number; discount?: number; discountPercent?: number };
  stock?: number;
  inventory?: { quantity?: number; track?: boolean };
}

export interface Product {
  sk: string;
  data: ProductData;
  post?: { tags?: string[]; categories?: string[] };
  createdate?: string;
}

export interface Restaurant {
  sk: string;
  name: string;           // slug (products' data.brand)
  title: string;
  cuisine: string[];
  priceLevel?: string;
  rating?: number;
  ratingCount?: number;
  prep?: [number, number];
  description?: string;
  image?: string;
  logo?: string;
  sections: string[];
  hours?: string;
  phone?: string;
  address: string;        // one line, geocodable
  street?: string;
}

/** One selected option on a line, as the engine prices it. */
export interface LineOption { name: string; label?: string; value: string }

export interface CartLine {
  sku: string;
  quantity: number;
  name?: string;
  image?: string;
  options?: LineOption[];
  /** set by the engine's calculation */
  unitPrice?: number;
  lineTotal?: number;
  amount?: number;
  originalPrice?: number;
}

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  count: number;
  valid: boolean;
  message?: string;
}

export interface Cart {
  id: string;
  lines: CartLine[];
  totals: CartTotals;
  /** food carts: the one restaurant this basket is from */
  restaurant?: string;
  couponCode?: string;
}

export interface OrderLine { sku?: string; name?: string; quantity: number; price?: number; amount?: number; image?: string; options?: LineOption[] }
export interface Order {
  sk: string;
  orderNumber: string;
  status: string;
  createdate?: string;
  lines: OrderLine[];
  subtotal?: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency: string;
  email?: string;
  name?: string;
  shippingAddress?: Record<string, any>;
  payments?: { gateway?: string; amount?: number }[];
  raw: any;
}

export interface ReturnRow {
  sk: string;
  rmaNumber: string;
  orderNumber: string;
  status: string;
  reason?: string;
  reasonCategory?: string;
  createdate?: string;
  items: { sku?: string; name?: string; returnQuantity?: number; price?: number }[];
  refundAmount?: number;
}

export interface GiftCardRow {
  serial: string;
  code?: string;
  balance: number;
  usableBalance?: number;
  amount?: number;
  currency: string;
  status?: string;
  expiresOn?: string;
}
