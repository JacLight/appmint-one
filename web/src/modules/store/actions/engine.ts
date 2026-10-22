"use server";

/**
 * The ported base-app storefront calls `getAppEngineClient().processRequest(method, path, body)`
 * from the browser. Here that call becomes a server action: each (method, path) the ported
 * code makes is matched to its named function in `@/api/store` (the app token + the
 * customer's cookie JWT go with it there). A path that is not listed is refused, so the
 * browser cannot reach any other engine route through this.
 */
import * as S from "@/api/store";
import { getErrorMessage } from "@/lib/errors";

export type EngineResult = { ok: true; data: any } | { ok: false; status: number; body: any; message: string };

type Handler = (m: RegExpMatchArray, body: any, query: string, q: URLSearchParams) => Promise<any>;
const dec = decodeURIComponent;

const ROUTES: [string, RegExp, Handler][] = [
  // pricing, discounts, cart
  ["post", /^storefront\/pricing\/calculate$/, (_m, b) => S.priceItem(b)],
  ["post", /^storefront\/pricing\/calculate-cart$/, (_m, b) => S.priceCart(b)],
  ["post", /^storefront\/discounts\/calculate$/, (_m, b) => S.cartSummary(b)],
  ["post", /^storefront\/discounts\/validate$/, (_m, b) => S.validateDiscount(b)],
  ["post", /^storefront\/discounts\/apply$/, (_m, b) => S.applyDiscount(b)],
  ["get", /^storefront\/discounts\/promotions\/active$/, () => S.activePromotions()],
  ["post", /^storefront\/cart\/update\/([^/]+)$/, (m, b) => S.saveCartRecord(dec(m[1]), b)],
  ["get", /^storefront\/cart\/mine$/, () => S.mySavedCart()],
  // pay + place
  ["get", /^storefront\/payment-gateways$/, () => S.paymentGateways()],
  ["post", /^storefront\/stripe\/intent$/, (_m, b) => S.stripeIntent(b)],
  ["post", /^storefront\/checkout-cart$/, (_m, b) => S.checkoutCart(b)],
  ["get", /^storefront\/order\/email\/([^/]+)\/([^/]+)$/, (m) => S.orderByEmail(dec(m[1]), dec(m[2]))],
  // catalog
  ["get", /^storefront\/product\/([^/]+)$/, (m) => S.productRecord(dec(m[1]))],
  ["get", /^storefront\/products$/, (_m, _b, qs) => S.searchProductsRaw(qs)],
  ["get", /^storefront\/attributes\/([^/]+)$/, (m) => S.attributeDefinition(dec(m[1]))],
  // shipping
  ["post", /^shipping\/verify-address$/, (_m, b) => S.verifyShippingAddress(b?.address)],
  ["get", /^shipping\/order\/status\/([^/]+)$/, (m, _b, _qs, q) => S.orderShippingStatus(dec(m[1]), q.get("email") || undefined)],
  ["get", /^shipping\/track\/([^/]+)$/, (m) => S.trackShipment(dec(m[1]))],
  // addresses
  ["get", /^client-data\/addresses$/, () => S.myAddresses()],
  ["post", /^client-data\/addresses$/, (_m, b) => S.saveAddress(b)],
  ["post", /^client-data\/addresses\/autocomplete$/, (_m, b) => S.addressAutocomplete(b)],
  ["get", /^client-data\/addresses\/place\/([^/]+)$/, (m) => S.placeDetails(dec(m[1]))],
  // gift cards
  ["get", /^client\/giftcards\/balance$/, (_m, _b, qs) => S.giftCardBalanceRaw(qs)],
  ["post", /^client\/giftcards\/redeem$/, (_m, b) => S.redeemGiftCard(b)],
  ["get", /^client\/giftcards\/me$/, () => S.myGiftCardsRaw()],
  ["post", /^client\/giftcards\/me\/([^/]+)\/share$/, (m, b) => S.shareGiftCard(dec(m[1]), b)],
  // returns
  ["get", /^storefront\/returns\/my-returns$/, () => S.myReturnsRaw()],
  ["post", /^storefront\/returns\/request$/, (_m, b) => S.requestReturnRaw(b)],
  ["put", /^storefront\/returns\/rma\/([^/]+)\/ship$/, (m, b) => S.shipReturn(dec(m[1]), b)],
  ["put", /^storefront\/returns\/rma\/([^/]+)\/cancel$/, (m, b) => S.cancelReturnRaw(dec(m[1]), b)],
  // subscriptions
  ["get", /^storefront\/subscriptions\/plans$/, () => S.subscriptionPlans()],
  ["get", /^storefront\/subscriptions\/get\/me$/, () => S.mySubscriptions()],
  ["post", /^storefront\/subscriptions\/subscribe$/, (_m, b) => S.subscribe(b)],
  ["get", /^storefront\/subscriptions\/([^/]+)$/, (m) => S.subscriptionRecord(dec(m[1]))],
  ["post", /^storefront\/subscriptions\/([^/]+)\/([^/]+)$/, (m, b) => S.subscriptionAction(dec(m[1]), dec(m[2]), b)],
  // product reviews — comments on a product (sf_product) and its comments' replies, likes, reports
  ["get", /^comments\/(sf_product)\/([^/]+)$/, (m, _b, qs) => S.productComments(m[1], dec(m[2]), qs)],
  ["post", /^comments\/(sf_product)\/([^/]+)$/, (m, b) => S.postProductComment(m[1], dec(m[2]), b)],
  ["get", /^comments\/([^/]+)\/replies$/, (m, _b, qs) => S.commentReplies(dec(m[1]), qs)],
  ["post", /^comments\/([^/]+)\/report$/, (m, b) => S.reportComment(dec(m[1]), b)],
  ["put", /^comments\/([^/]+)$/, (m, b) => S.editComment(dec(m[1]), b)],
  ["delete", /^comments\/([^/]+)$/, (m) => S.removeComment(dec(m[1]))],
  ["post", /^stats\/(sf_product|comment)\/([^/]+)\/like$/, (m, b) => S.likeSignal(m[1], dec(m[2]), b)],
  // wishlist
  ["get", /^client-data\/wishlist$/, () => S.myWishlists()],
  ["post", /^client-data\/wishlist$/, (_m, b) => S.createWishlist(b)],
  ["delete", /^client-data\/wishlist-list\/([^/]+)$/, (m) => S.deleteWishlist(dec(m[1]))],
  ["post", /^client-data\/wishlist\/([^/]+)$/, (m, b) => S.addWishlistItem(dec(m[1]), b)],
  ["delete", /^client-data\/wishlist\/([^/]+)$/, (m, _b, qs) => S.removeWishlistItem(dec(m[1]), qs)],
];

export async function storeRoute(method: string, rawPath: string, body?: any): Promise<EngineResult> {
  const verb = String(method || "get").toLowerCase();
  const [p, qs = ""] = String(rawPath || "").replace(/^\/+/, "").replace(/^api\//, "").split("?");
  for (const [m, re, fn] of ROUTES) {
    if (m !== verb) continue;
    const hit = p.match(re);
    if (!hit) continue;
    try {
      return { ok: true, data: (await fn(hit, body ?? undefined, qs, new URLSearchParams(qs))) ?? null };
    } catch (e: any) {
      const status = Number(e?.response?.status ?? e?.status ?? 500);
      return { ok: false, status, body: e?.response?.data ?? null, message: getErrorMessage(e, "Something went wrong. Please try again.") };
    }
  }
  return { ok: false, status: 404, body: { message: "Not available here" }, message: "Not available here" };
}
