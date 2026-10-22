'use client';

// from base-app/src/components/storefront/gift-card/GiftCardOptions.tsx — ported verbatim; only import paths rewired.
import React from 'react';
import type { LineItemOption } from '../utils/custom-attributes';

/**
 * What a gift-card product asks the shopper on the product page: how much to
 * load, who it is for, a note, and when to send it.
 *
 * The answers travel on the cart line as named `options[]` — the same channel
 * preset picks and custom inputs use — so nothing else in the cart, checkout or
 * order has to know a gift card is special. The server prices the line from the
 * "Gift card amount" option and issues the card from the rest when the order is
 * paid. These option names are a contract with `GiftCardService.LINE_OPTIONS`.
 */
export const GIFT_CARD_OPTION_NAMES = {
  amount: 'Gift card amount',
  recipientName: 'Recipient name',
  recipientEmail: 'Recipient email',
  recipientPhone: 'Recipient phone',
  message: 'Gift message',
  deliverAt: 'Deliver on',
  /** Adds the value to a card the buyer already holds (its serial) instead of issuing a new one. */
  reloadSerial: 'Reload card',
} as const;

export interface GiftCardProductConfig {
  enabled?: boolean;
  denominations?: number[];
  allowCustomAmount?: boolean;
  minAmount?: number;
  maxAmount?: number;
  cardType?: 'digital' | 'physical';
  expiresAfterDays?: number;
  collectRecipient?: boolean;
  allowScheduledDelivery?: boolean;
}

export interface GiftCardChoice {
  amount: number | null;
  customAmount: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  message: string;
  deliverAt: string;
  forMyself: boolean;
}

export const emptyGiftCardChoice = (config: GiftCardProductConfig, productPrice: number): GiftCardChoice => {
  const denominations = (config.denominations || []).filter(d => d > 0);
  return {
    amount: denominations.length ? denominations[0] : productPrice > 0 ? productPrice : null,
    customAmount: '',
    recipientName: '',
    recipientEmail: '',
    recipientPhone: '',
    message: '',
    deliverAt: '',
    forMyself: false,
  };
};

/** The value the line will carry, or null when the shopper has not picked a valid one yet. */
export const giftCardChoiceValue = (choice: GiftCardChoice, config: GiftCardProductConfig): number | null => {
  if (choice.customAmount !== '') {
    const v = Math.round(Number(choice.customAmount) * 100) / 100;
    if (!(v > 0)) return null;
    if (config.minAmount && v < config.minAmount) return null;
    if (config.maxAmount && v > config.maxAmount) return null;
    return v;
  }
  return choice.amount && choice.amount > 0 ? choice.amount : null;
};

/** Why the current choice cannot go in the cart, or null when it can. */
export const giftCardChoiceProblem = (choice: GiftCardChoice, config: GiftCardProductConfig): string | null => {
  const value = giftCardChoiceValue(choice, config);
  if (value === null) {
    if (choice.customAmount !== '') {
      if (config.minAmount && Number(choice.customAmount) < config.minAmount) return `The minimum is $${config.minAmount.toFixed(2)}`;
      if (config.maxAmount && Number(choice.customAmount) > config.maxAmount) return `The maximum is $${config.maxAmount.toFixed(2)}`;
      return 'Enter an amount greater than zero';
    }
    return 'Choose an amount';
  }
  if (config.collectRecipient !== false && !choice.forMyself) {
    const email = choice.recipientEmail.trim();
    const phone = choice.recipientPhone.replace(/\D/g, '');
    if (!email && !phone) return "Enter the recipient's email or mobile number, or choose to send it to yourself";
    if (email && !/.+@.+\..+/.test(email)) return "The recipient's email does not look right";
    if (choice.recipientPhone.trim() && phone.length < 7) return "The recipient's mobile number does not look right";
  }
  if (choice.deliverAt && new Date(choice.deliverAt).getTime() < Date.now() - 86400000) return 'The delivery date is in the past';
  return null;
};

/** The options the cart line carries. */
export const giftCardChoiceOptions = (choice: GiftCardChoice, config: GiftCardProductConfig): LineItemOption[] => {
  const value = giftCardChoiceValue(choice, config);
  const out: LineItemOption[] = [];
  if (value !== null) out.push({ name: GIFT_CARD_OPTION_NAMES.amount, value: String(value), type: 'text' });
  if (!choice.forMyself) {
    if (choice.recipientName.trim()) out.push({ name: GIFT_CARD_OPTION_NAMES.recipientName, value: choice.recipientName.trim(), type: 'text' });
    if (choice.recipientEmail.trim()) out.push({ name: GIFT_CARD_OPTION_NAMES.recipientEmail, value: choice.recipientEmail.trim(), type: 'text' });
    if (choice.recipientPhone.trim()) out.push({ name: GIFT_CARD_OPTION_NAMES.recipientPhone, value: choice.recipientPhone.trim(), type: 'text' });
    if (choice.message.trim()) out.push({ name: GIFT_CARD_OPTION_NAMES.message, value: choice.message.trim(), type: 'text' });
  }
  if (choice.deliverAt) out.push({ name: GIFT_CARD_OPTION_NAMES.deliverAt, value: new Date(`${choice.deliverAt}T09:00:00`).toISOString(), type: 'text' });
  return out;
};

const money = (v: number) => `$${v.toFixed(2)}`;

export function GiftCardOptions({ config, choice, onChange, showErrors }: { config: GiftCardProductConfig; choice: GiftCardChoice; onChange: (next: GiftCardChoice) => void; showErrors?: boolean }) {
  const denominations = (config.denominations || []).filter(d => d > 0);
  const problem = giftCardChoiceProblem(choice, config);
  const set = (patch: Partial<GiftCardChoice>) => onChange({ ...choice, ...patch });
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6 border-t border-gray-200 pt-6">
      {(denominations.length > 0 || config.allowCustomAmount) && (
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase mb-3">Amount</p>
          {denominations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {denominations.map(d => {
                const active = choice.customAmount === '' && choice.amount === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ amount: d, customAmount: '' })}
                    className={`min-w-[84px] px-4 py-2.5 text-sm font-medium border transition-colors ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-800 hover:border-gray-900'}`}
                  >
                    {money(d)}
                  </button>
                );
              })}
            </div>
          )}
          {config.allowCustomAmount && (
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1">
                Or enter your own{config.minAmount || config.maxAmount ? ` (${config.minAmount ? money(config.minAmount) : 'any'} – ${config.maxAmount ? money(config.maxAmount) : 'any'})` : ''}
              </label>
              <div className="flex items-center border border-gray-300 focus-within:border-gray-900 max-w-[220px]">
                <span className="px-3 text-gray-500">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={config.minAmount || 1}
                  max={config.maxAmount || undefined}
                  step="1"
                  value={choice.customAmount}
                  onChange={e => set({ customAmount: e.target.value })}
                  placeholder="0.00"
                  className="w-full py-2.5 pr-3 text-sm outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {config.collectRecipient !== false && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">Who is it for?</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={choice.forMyself} onChange={e => set({ forMyself: e.target.checked })} className="accent-gray-900" />
              Send it to me
            </label>
          </div>
          {!choice.forMyself && (
            <>
              <input type="text" value={choice.recipientName} onChange={e => set({ recipientName: e.target.value })} placeholder="Recipient's name" className="w-full border border-gray-300 focus:border-gray-900 px-3 py-2.5 text-sm outline-none" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="email" value={choice.recipientEmail} onChange={e => set({ recipientEmail: e.target.value })} placeholder="Recipient's email" className="border border-gray-300 focus:border-gray-900 px-3 py-2.5 text-sm outline-none" />
                <input type="tel" inputMode="tel" autoComplete="off" value={choice.recipientPhone} onChange={e => set({ recipientPhone: e.target.value })} placeholder="Mobile, to send it by text" className="border border-gray-300 focus:border-gray-900 px-3 py-2.5 text-sm outline-none" />
              </div>
              <p className="text-xs text-gray-500">Email, text, or both — it goes to whichever you fill in.</p>
              <textarea value={choice.message} onChange={e => set({ message: e.target.value.slice(0, 400) })} placeholder="Add a message (optional)" rows={3} className="w-full border border-gray-300 focus:border-gray-900 px-3 py-2.5 text-sm outline-none resize-none" />
            </>
          )}
        </div>
      )}

      {config.allowScheduledDelivery !== false && (
        <div>
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase mb-2">When should it arrive?</p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => set({ deliverAt: '' })} className={`px-4 py-2.5 text-sm border ${!choice.deliverAt ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-800 hover:border-gray-900'}`}>
              Right away
            </button>
            <input type="date" min={todayIso} value={choice.deliverAt} onChange={e => set({ deliverAt: e.target.value })} className="border border-gray-300 focus:border-gray-900 px-3 py-2.5 text-sm outline-none" aria-label="Delivery date" />
          </div>
          <p className="mt-2 text-xs text-gray-500">{config.expiresAfterDays ? `The card is valid for ${config.expiresAfterDays} days from purchase.` : 'The card never expires.'} It arrives by email or text with a link to the card and its code.</p>
        </div>
      )}

      {showErrors && problem && <p className="text-sm text-red-600">{problem}</p>}
    </div>
  );
}

export default GiftCardOptions;
