/**
 * Store (retail + food + course products): the adapter between the Store screens and appengine:
 *   storefront/*          catalog, cart, pricing, Stripe intent, checkout, orders, returns
 *   client-data/orders    the signed-in customer's orders
 *   client/giftcards/*    balance, my cards
 * Every call carries the app token + the customer JWT (lib/api). Prices always come from
 * the engine — the screens never add up money themselves.
 */
import "server-only";
import { cache } from "react";
import { apiReq } from "@/lib/api";
import { getAppEngineClient } from "@/lib/appmint-client";
import type { Cart, CartLine, CartTotals, GiftCardRow, LineOption, Order, Product, Restaurant, ReturnRow } from "@/modules/store/lib/types";

const enc = encodeURIComponent;
const arr = <T = any>(r: any): T[] => (Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : []);

/** Listed = for sale and not hidden. sf_product's status enum is draft | new | pre-order | available |
 *  sold-out | discontinued | not-for-sale (older records use "active"); the products route drops
 *  hidden ones but not drafts. Sold-out stays listed and shows as sold out. */
const UNLISTED = new Set(["draft", "discontinued", "not-for-sale"]);
const listed = (p: Product) => !!p?.data?.sku && !p.data.hide && !UNLISTED.has(String(p.data.status || ""));

export interface ProductQuery {
  tags: string[];
  category?: string;
  brand?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "featured" | "price-asc" | "price-desc" | "newest" | "rating";
  page?: number;
  pageSize?: number;
}

export async function listProducts(q: ProductQuery): Promise<{ products: Product[]; total: number }> {
  const sort = q.sort === "price-asc" ? { s: "data.price", st: 1 } : q.sort === "price-desc" ? { s: "data.price", st: -1 } : q.sort === "newest" ? { s: "createdate", st: -1 } : q.sort === "rating" ? { s: "data.rating", st: -1 } : { s: "createdate", st: 1 };
  const r: any = await apiReq("GET", "storefront/products", {
    query: {
      tag: q.tags.join(","), category: q.category, brand: q.brand, keyword: q.keyword?.trim() || undefined,
      minPrice: q.minPrice, maxPrice: q.maxPrice, ps: q.pageSize ?? 60, p: q.page ?? 1, ...sort,
    },
  });
  const products = arr<Product>(r).filter(listed);
  return { products, total: Number(r?.total ?? products.length) };
}

export const getProduct = cache(async (id: string): Promise<Product | null> => {
  try {
    const p: any = await apiReq("GET", `storefront/product/${enc(id)}`);
    return p?.sk && listed(p) ? (p as Product) : null;
  } catch (e: any) {
    if ((e?.response?.status ?? e?.status) === 404) return null;
    throw e;
  }
});

export async function relatedProducts(id: string, tags: string[], limit = 8): Promise<Product[]> {
  const r: any = await apiReq("GET", `storefront/product/${enc(id)}/related`, { query: { limit: 24 } }).catch(() => []);
  return arr<Product>(r).filter((p) => listed(p) && (p.post?.tags || []).some((t) => tags.includes(t))).slice(0, limit);
}

/* ───────────── restaurants (sf_brand, kind "restaurant") ───────────── */

function toRestaurant(b: any): Restaurant | null {
  const d = b?.data || {};
  if (d.kind !== "restaurant" || !d.name) return null;
  const c = Array.isArray(d.contacts) ? d.contacts[0] : null;
  const a = c?.address || {};
  const address = [a.street1, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return {
    sk: String(b.sk), name: String(d.name), title: String(d.title || d.name),
    cuisine: Array.isArray(d.cuisine) ? d.cuisine : [], priceLevel: d.priceLevel, rating: Number(d.rating) || undefined,
    ratingCount: Number(d.ratingCount) || undefined, prep: Array.isArray(d.prep) ? [Number(d.prep[0]), Number(d.prep[1])] : undefined,
    description: d.description, image: d.image, logo: d.logo, sections: Array.isArray(d.sections) ? d.sections : [],
    hours: d.hours, phone: c?.phone, address, street: a.street1,
  };
}

export const listRestaurants = cache(async (tag: string): Promise<Restaurant[]> => {
  const r: any = await apiReq("GET", "storefront/brands", { query: { ps: 500 } });
  return arr(r)
    .filter((b: any) => Array.isArray(b?.data?.tags) && b.data.tags.includes(tag))
    .map(toRestaurant)
    .filter((x): x is Restaurant => !!x);
});

export async function getRestaurant(tag: string, name: string): Promise<Restaurant | null> {
  return (await listRestaurants(tag)).find((r) => r.name === name) || null;
}

export async function menuOf(tag: string, restaurant: string): Promise<Product[]> {
  const { products } = await listProducts({ tags: [tag], brand: restaurant, pageSize: 200 });
  return products.filter((p) => p.data.brand === restaurant);
}

/* ───────────── pricing ───────────── */

/** The engine's price for one selection (options + quantity) — the PDP / item sheet
 *  number. Read-only: calculate-cart does not write the lines it is given. */
export async function priceSelection(cartId: string | undefined, sku: string, quantity: number, options: LineOption[]): Promise<{ unit: number; total: number; currency: string }> {
  const r: any = await apiReq("POST", "storefront/pricing/calculate-cart", {
    data: { ...(cartId ? { cartId } : {}), productItems: [{ sku, quantity, options: options.map(({ name, value }) => ({ name, value })) }] },
  });
  const line = r?.productItems?.[0] || {};
  return { unit: Number(line.unitPrice ?? line.finalPrice ?? 0), total: Number(line.lineTotal ?? line.amount ?? r?.productSubtotal ?? 0), currency: String(line.currency || "USD") };
}

/* ───────────── cart ───────────── */

function toCart(c: any): Cart {
  const d = c?.data || {};
  const lines: CartLine[] = (d.productItems || []).map((l: any) => ({
    sku: l.sku, quantity: Number(l.quantity) || 1, name: l.name, image: l.image, options: l.options,
    unitPrice: l.unitPrice, lineTotal: l.lineTotal ?? l.amount, amount: l.amount, originalPrice: l.originalPrice,
  }));
  const totals: CartTotals = {
    subtotal: Number(d.productSubtotal ?? d.subtotal ?? 0),
    discount: Number(d.productDiscount ?? d.discount ?? 0),
    tax: Number(d.productTax ?? d.tax ?? 0),
    shipping: Number(d.productShipping ?? 0),
    total: Number(d.total ?? 0),
    currency: String(d.productItems?.[0]?.currency || d.currency || "USD"),
    count: lines.reduce((s, l) => s + l.quantity, 0),
    valid: d.valid !== false,
    message: d.message,
  };
  return { id: String(c?.cartId || c?.sk || ""), lines, totals, restaurant: d.restaurant, couponCode: d.couponCode };
}

/** A brand-new cart, made without the customer token: a signed-in customer's
 *  `cart/get` returns their one saved cart, and the shop and the food basket each
 *  need their own. The first update while signed in makes it theirs. */
export async function newCart(): Promise<Cart> {
  const api = getAppEngineClient();
  const c = await api.processRequest("GET", "storefront/cart/get/new", undefined, null);
  return toCart(c);
}

/** The stored cart with the engine's totals; null when it is gone.
 *  Read in two steps: the stored lines by id (without the customer token — a signed-in
 *  customer's cart/get answers with their one saved cart instead), then the totals from
 *  calculate-cart WITH the customer, which is exactly how the payment step checks the
 *  amount (assertIntentMatchesCart). calculate-cart never writes the cart. */
export async function readCart(id: string): Promise<Cart | null> {
  try {
    const api = getAppEngineClient();
    const c: any = await api.processRequest("GET", `storefront/cart/get/any/${enc(id)}`, undefined, null);
    if (String(c?.sk || c?.cartId) !== id) return null;
    const d = c.data || {};
    if (!d.productItems?.length) return toCart({ sk: id, data: { ...d, productItems: [], total: 0 } });
    const calc: any = await apiReq("POST", "storefront/pricing/calculate-cart", {
      data: { cartId: id, productItems: d.productItems, couponCode: d.couponCode || undefined, shippingAddress: d.shippingAddress, email: d.email },
    });
    const priced = (d.productItems as any[]).map((l, i) => ({ ...l, ...(calc?.productItems?.[i] || {}), name: l.name, image: l.image, options: l.options }));
    return toCart({ sk: id, data: { ...d, ...calc, productItems: priced, restaurant: d.restaurant, couponCode: d.couponCode } });
  } catch {
    return null;
  }
}

/** Replace the cart's lines (and the food basket's restaurant); the engine re-prices it. */
export async function writeCart(id: string, lines: CartLine[], extra: { restaurant?: string | null; shippingAddress?: any; email?: string; couponCode?: string } = {}): Promise<Cart> {
  const productItems = lines.map((l) => ({ sku: l.sku, quantity: l.quantity, name: l.name, image: l.image, options: l.options || [] }));
  const c = await apiReq("POST", `storefront/cart/update/${enc(id)}`, {
    data: { data: { productItems, rentalItems: [], ...(extra.restaurant !== undefined ? { restaurant: extra.restaurant } : {}), ...(extra.shippingAddress ? { shippingAddress: extra.shippingAddress } : {}), ...(extra.email ? { email: extra.email } : {}), ...(extra.couponCode !== undefined ? { couponCode: extra.couponCode } : {}) } },
  });
  const calc: any = (c as any)?.data || {};
  const priced = productItems.map((l, i) => ({ ...l, ...(calc.productItems?.[i] || {}), name: l.name, image: l.image, options: l.options }));
  return toCart({ ...(c as any), data: { ...calc, productItems: priced } });
}

/* ───────────── pay + place ───────────── */

/** A Stripe PaymentIntent for the cart's server total. The engine refuses (409) when
 *  `amount` is not what the stored cart comes to — nothing is charged then. */
export async function cartIntent(cartId: string, amount: number, email: string, partial = false): Promise<{ id: string; client_secret: string }> {
  return apiReq("POST", "storefront/stripe/intent", { data: { cartId, amount, currency: "usd", email, ...(partial ? { partial: true } : {}) } });
}

export interface PlaceInput {
  cartId: string;
  email: string;
  name: string;
  phone?: string;
  shippingAddress: { name?: string; street1: string; street2?: string; city: string; state: string; zip: string; country: string; phone?: string };
  paymentRef?: string;
  giftCards?: { code: string; pin?: string }[];
}

/** Writes the order from the STORED cart (priced on the server; the card charge is
 *  checked against it). */
export async function placeOrder(p: PlaceInput): Promise<any> {
  return apiReq("POST", "storefront/checkout-cart", {
    data: {
      cartId: p.cartId, email: p.email, name: p.name, phone: p.phone, shippingAddress: p.shippingAddress, billingAddress: p.shippingAddress,
      ...(p.paymentRef ? { paymentRef: p.paymentRef, paymentGateway: "stripe" } : {}),
      ...(p.giftCards?.length ? { giftCards: p.giftCards } : {}),
    },
  });
}

/* ───────────── orders ───────────── */

export function toOrder(o: any): Order | null {
  const d = o?.data;
  if (!d) return null;
  const items: any[] = d.productItems || d.items || [];
  return {
    sk: String(o.sk), orderNumber: String(d.number || d.orderNumber || o.sk), status: String(d.status || "new"), createdate: o.createdate,
    lines: items.map((l) => ({ sku: l.sku, name: l.name, quantity: Number(l.quantity) || 1, price: Number(l.unitPrice ?? l.price ?? 0), amount: Number(l.lineTotal ?? l.amount ?? 0), image: l.image, options: l.options })),
    subtotal: d.productSubtotal ?? d.subtotal, tax: d.tax, shipping: d.productShipping, discount: d.discount,
    total: Number(d.amount ?? d.total ?? 0), currency: String(d.currency || "USD"), email: d.email, name: d.name,
    shippingAddress: d.shippingAddress, payments: d.payments, raw: d,
  };
}

export async function myOrders(): Promise<Order[]> {
  const r: any = await apiReq("GET", "client-data/orders", { query: { limit: 100, sortBy: "createdate", sortOrder: "desc" } });
  return arr(r).map(toOrder).filter((x): x is Order => !!x)
    .sort((a, b) => String(b.createdate || "").localeCompare(String(a.createdate || "")));
}

export async function myOrder(orderNumber: string): Promise<Order | null> {
  try {
    return toOrder(await apiReq("GET", `client-data/orders/${enc(orderNumber)}`));
  } catch {
    return null;
  }
}

export async function cancelOrder(orderNumber: string, reason?: string) {
  return apiReq("POST", `storefront/order/cancel/${enc(orderNumber)}`, { data: { reason } });
}

/* ───────────── returns ───────────── */

function toReturn(r: any): ReturnRow {
  const d = r?.data || r || {};
  return {
    sk: String(r?.sk || d.rmaNumber), rmaNumber: String(d.rmaNumber || r?.sk), orderNumber: String(d.orderNumber || ""), status: String(d.status || "requested"),
    reason: d.reason, reasonCategory: d.reasonCategory, createdate: r?.createdate || d.createdAt,
    items: (d.items || []).map((i: any) => ({ sku: i.sku, name: i.name, returnQuantity: i.returnQuantity, price: i.price })),
    refundAmount: d.refundAmount ?? d.refund?.amount,
  };
}

export async function myReturns(): Promise<ReturnRow[]> {
  const r: any = await apiReq("GET", "storefront/returns/my-returns");
  return arr(r).map(toReturn).sort((a, b) => String(b.createdate || "").localeCompare(String(a.createdate || "")));
}

export async function requestReturn(body: {
  orderNumber: string; reason: string; reasonCategory: string; type: "return";
  items: { sku: string; name: string; quantity: number; returnQuantity: number; price: number; reason: string; condition: string }[];
  refundMethod?: string;
}): Promise<ReturnRow> {
  return toReturn(await apiReq("POST", "storefront/returns/request", { data: body }));
}

export async function cancelReturn(rma: string, reason: string) {
  return apiReq("PUT", `storefront/returns/rma/${enc(rma)}/cancel`, { data: { reason } });
}

/* ───────────── gift cards ───────────── */

function toCard(c: any): GiftCardRow {
  const d = c?.data || c || {};
  return {
    serial: String(d.serial || c?.sk || ""), code: d.code, balance: Number(d.balance ?? 0), usableBalance: d.usableBalance != null ? Number(d.usableBalance) : undefined,
    amount: d.amount != null ? Number(d.amount) : d.initialAmount != null ? Number(d.initialAmount) : undefined, currency: String(d.currency || "USD"), status: d.status, expiresOn: d.expiresOn || d.expiresAt,
  };
}

export async function myGiftCards(): Promise<GiftCardRow[]> {
  const r: any = await apiReq("GET", "client/giftcards/me");
  const list = Array.isArray(r?.cards) ? r.cards : arr(r);
  return list.map(toCard);
}

export async function giftCardBalance(code: string, pin?: string): Promise<{ ok: boolean; balance?: number; currency?: string; status?: string; message?: string }> {
  const r: any = await apiReq("GET", "client/giftcards/balance", { query: { code, pin } });
  const d = r?.data || r || {};
  return { ok: d.usable !== false && d.valid !== false, balance: Number(d.balance ?? d.usableBalance ?? 0), currency: String(d.currency || "USD"), status: d.status, message: d.message || d.reason };
}

/* ═══════════ storefront checkout, cart, account views ═══════════
 * One function per engine operation the ported base-app code makes. Bodies and
 * responses pass through exactly as base-app's storefront-api / services expect them
 * (those files keep their own shaping logic). Reached only through
 * modules/store/actions/engine.ts. */

type Body = Record<string, any>;

// pricing, discounts, cart
export const priceItem = (body: Body) => apiReq("POST", "storefront/pricing/calculate", { data: body });
export const priceCart = (body: Body) => apiReq("POST", "storefront/pricing/calculate-cart", { data: body });
export const cartSummary = (body: Body) => apiReq("POST", "storefront/discounts/calculate", { data: body });
export const validateDiscount = (body: Body) => apiReq("POST", "storefront/discounts/validate", { data: body });
export const applyDiscount = (body: Body) => apiReq("POST", "storefront/discounts/apply", { data: body });
export const activePromotions = () => apiReq("GET", "storefront/discounts/promotions/active");
export const saveCartRecord = (cartId: string, body: Body) => apiReq("POST", `storefront/cart/update/${enc(cartId)}`, { data: body });
export const mySavedCart = () => apiReq("GET", "storefront/cart/mine");

// pay + place
export const paymentGateways = () => apiReq("GET", "storefront/payment-gateways");
export const stripeIntent = (body: Body) => apiReq("POST", "storefront/stripe/intent", { data: body });
export const checkoutCart = (body: Body) => apiReq("POST", "storefront/checkout-cart", { data: body });
export const orderByEmail = (email: string, orderNumber: string) => apiReq("GET", `storefront/order/email/${enc(email)}/${enc(orderNumber)}`);

// catalog
export const productRecord = (sku: string) => apiReq("GET", `storefront/product/${enc(sku)}`);
export const searchProductsRaw = (query: string) => apiReq("GET", `storefront/products${query ? `?${query}` : ""}`);
export const attributeDefinition = (name: string) => apiReq("GET", `storefront/attributes/${enc(name)}`);

// shipping
export const verifyShippingAddress = (address: Body) => apiReq("POST", "shipping/verify-address", { data: { address } });
export const orderShippingStatus = (orderNumber: string, email?: string) => apiReq("GET", `shipping/order/status/${enc(orderNumber)}`, { query: { email } });
export const trackShipment = (trackingNumber: string) => apiReq("GET", `shipping/track/${enc(trackingNumber)}`);

// the shopper's saved addresses (checkout address picker)
export const myAddresses = () => apiReq("GET", "client-data/addresses");
export const saveAddress = (address: Body) => apiReq("POST", "client-data/addresses", { data: address });
export const addressAutocomplete = (body: Body) => apiReq("POST", "client-data/addresses/autocomplete", { data: body });
export const placeDetails = (placeId: string) => apiReq("GET", `client-data/addresses/place/${enc(placeId)}`);

// gift cards
export const giftCardBalanceRaw = (query: string) => apiReq("GET", `client/giftcards/balance?${query}`);
export const redeemGiftCard = (body: Body) => apiReq("POST", "client/giftcards/redeem", { data: body });
export const myGiftCardsRaw = () => apiReq("GET", "client/giftcards/me");
export const shareGiftCard = (serial: string, body: Body) => apiReq("POST", `client/giftcards/me/${enc(serial)}/share`, { data: body });

// returns
export const myReturnsRaw = () => apiReq("GET", "storefront/returns/my-returns");
export const requestReturnRaw = (body: Body) => apiReq("POST", "storefront/returns/request", { data: body });
export const shipReturn = (rma: string, body: Body) => apiReq("PUT", `storefront/returns/rma/${enc(rma)}/ship`, { data: body });
export const cancelReturnRaw = (rma: string, body: Body) => apiReq("PUT", `storefront/returns/rma/${enc(rma)}/cancel`, { data: body });

// subscriptions (subscription products on the product page)
export const subscriptionPlans = () => apiReq("GET", "storefront/subscriptions/plans");
export const mySubscriptions = () => apiReq("GET", "storefront/subscriptions/get/me");
export const subscriptionRecord = (id: string) => apiReq("GET", `storefront/subscriptions/${enc(id)}`);
export const subscribe = (body: Body) => apiReq("POST", "storefront/subscriptions/subscribe", { data: body });
export const subscriptionAction = (id: string, action: string, body: Body) => apiReq("POST", `storefront/subscriptions/${enc(id)}/${enc(action)}`, { data: body });

// wishlist
export const myWishlists = () => apiReq("GET", "client-data/wishlist");
export const createWishlist = (body: Body) => apiReq("POST", "client-data/wishlist", { data: body });
export const deleteWishlist = (id: string) => apiReq("DELETE", `client-data/wishlist-list/${enc(id)}`);
export const addWishlistItem = (productId: string, body: Body) => apiReq("POST", `client-data/wishlist/${enc(productId)}`, { data: body });
export const removeWishlistItem = (productId: string, query: string) => apiReq("DELETE", `client-data/wishlist/${enc(productId)}${query ? `?${query}` : ""}`);

// product reviews (base-app ProductComments): comments on a product, their replies, likes, reports
export const productComments = (datatype: string, id: string, query: string) => apiReq("GET", `comments/${enc(datatype)}/${enc(id)}${query ? `?${query}` : ""}`);
export const postProductComment = (datatype: string, id: string, body: Body) => apiReq("POST", `comments/${enc(datatype)}/${enc(id)}`, { data: body });
export const commentReplies = (commentId: string, query: string) => apiReq("GET", `comments/${enc(commentId)}/replies${query ? `?${query}` : ""}`);
export const editComment = (commentId: string, body: Body) => apiReq("PUT", `comments/${enc(commentId)}`, { data: body });
export const removeComment = (commentId: string) => apiReq("DELETE", `comments/${enc(commentId)}`);
export const reportComment = (commentId: string, body: Body) => apiReq("POST", `comments/${enc(commentId)}/report`, { data: body });
export const likeSignal = (datatype: string, id: string, body: Body) => apiReq("POST", `stats/${enc(datatype)}/${enc(id)}/like`, { data: body });
