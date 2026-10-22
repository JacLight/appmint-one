'use client';

// from base-app/src/components/storefront/gift-card/checkout-gift-cards.ts — ported verbatim; only import paths rewired.
/**
 * The gift cards a shopper applied at checkout, as the order will send them.
 *
 * Codes ride on the persisted checkout data, so they survive a card payment
 * that bounces through the bank and back. PINs — printed cards only — are kept
 * in session storage instead: they last as long as the tab, never land in the
 * long-lived cart, and are dropped when the order is placed.
 */
const PIN_KEY = 'checkout-gift-card-pins';

/** The payment reference a checkout paid with no card — gift cards and/or store credit / points cover it all — goes to the success page with. */
export const GIFT_CARDS_ONLY = 'gift-cards';

const readPins = (): Record<string, string> => {
  try {
    return JSON.parse(sessionStorage.getItem(PIN_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

export const setGiftCardPin = (code: string, pin: string) => {
  try {
    const pins = readPins();
    if (pin) pins[code] = pin;
    else delete pins[code];
    sessionStorage.setItem(PIN_KEY, JSON.stringify(pins));
  } catch {
    /* storage blocked — the card will ask again */
  }
};

export const clearGiftCardPins = () => {
  try {
    sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* nothing to clear */
  }
};

/** Codes → what the server takes: `{ code, pin? }`. */
export const giftCardsWithPins = (codes: string[] | undefined): { code: string; pin?: string }[] => {
  const pins = readPins();
  return (codes || []).map(code => (pins[code] ? { code, pin: pins[code] } : { code }));
};
