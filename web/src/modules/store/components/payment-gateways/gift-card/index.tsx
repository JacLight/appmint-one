'use client';

// from base-app/src/components/payment-gateways/gift-card/index.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useMemo, useState } from 'react';
import { PaymentComponentProps } from '../types';
import { getAppEngineClient } from '@/modules/store/lib/appmint-client';
import { giftCardService, type CustomerGiftCard } from '@/modules/store/services/gift-card-service';

interface GiftCardPaymentProps extends PaymentComponentProps {
  /**
   * Let the card cover part of the amount. A payment link records whatever the
   * card actually paid and stays open for the rest, so it can take a partial;
   * the cart creates the order on the assumption it was paid in full, so it
   * cannot.
   */
  allowPartial?: boolean;
  /** What the redemption is recorded against — the invoice, tab or cart id. */
  orderNumber?: string;
}

type Balance = {
  valid: boolean;
  balance: number;
  currency: string;
  status: string;
  message?: string;
  maxUsePerTransaction?: number;
  minPurchase?: number;
};

// Written the way the rest of the payment page writes money ($475.00), not
// as a currency code in front of a bare number.
const money = (v: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(Number(v) || 0);
  } catch {
    return `${currency} ${(Number(v) || 0).toFixed(2)}`;
  }
};
/** The server's own words for what went wrong; its error body carries them in `error`, sometimes `message`. */
const reason = (err: any, fallback: string) => err?.response?.data?.error || err?.response?.data?.message || (err?.response?.status === 429 ? 'Too many checks in a short time. Try again in a few minutes.' : err?.message) || fallback;

/**
 * Pay with a gift card.
 *
 * Two server calls: a balance check by code (and PIN for physical cards), then
 * a redemption with an idempotency key, so a retried click cannot spend twice.
 * The redemption's `transactionId` (GCT-…) is handed up as the payment
 * reference; the server verifies it against the ledger before recording the
 * payment, so nothing here is trusted for the amount.
 */
export const GiftCardPayment: React.FC<GiftCardPaymentProps> = ({ amount, customer, onSuccess, onError, onCancel, disabled, showTitle, className, metadata, allowPartial = false, orderNumber }) => {
  const [code, setCode] = useState('');
  const codeTyped = code;
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [problem, setProblem] = useState('');
  // One key per attempt on this screen; a retry after a lost response reuses it.
  const [idempotencyKey] = useState(() => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`));

  const client = useMemo(() => getAppEngineClient(), []);
  const currency = amount.currency || balance?.currency || 'USD';

  // A signed-in customer's own cards, so they can pick one instead of typing.
  // Anonymous shoppers get an empty list and never see the picker.
  const [wallet, setWallet] = useState<CustomerGiftCard[]>([]);
  useEffect(() => {
    if (!customer?.email) return;
    let alive = true;
    giftCardService.getMyCards().then(dto => {
      if (alive) setWallet(dto.data.filter(c => c.data.status === 'active' && c.data.balance > 0));
    });
    return () => {
      alive = false;
    };
  }, [customer?.email]);

  const applied = useMemo(() => {
    if (!balance?.valid) return 0;
    let cap = Math.min(balance.balance, amount.amount);
    if (balance.maxUsePerTransaction) cap = Math.min(cap, balance.maxUsePerTransaction);
    return Math.round(cap * 100) / 100;
  }, [balance, amount.amount]);
  const remainderDue = Math.round((amount.amount - applied) * 100) / 100;
  const coversAll = !!balance?.valid && remainderDue <= 0.005;
  const needsPin = balance?.status === 'invalid_pin';

  // `card` is a code picked from the wallet: picking one checks it straight
  // away, so a signed-in customer never has to press Check on her own card.
  const check = async (card?: string) => {
    const code = card ?? codeTyped;
    if (!code.trim()) {
      setProblem('Enter the gift card code');
      return;
    }
    setChecking(true);
    setProblem('');
    try {
      const qs = new URLSearchParams({ code: code.trim() });
      if (pin.trim() && card === undefined) qs.set('pin', pin.trim());
      const result: Balance = await client.processRequest('get', `client/giftcards/balance?${qs.toString()}`);
      setBalance(result);
      if (!result?.valid) setProblem(result?.status === 'invalid_pin' ? (pin ? 'That PIN is not right' : 'This card has a PIN — enter it to continue') : result?.message || 'This gift card cannot be used');
      else if (result.minPurchase && amount.amount < result.minPurchase) setProblem(`This card can only be used on orders of ${money(result.minPurchase, result.currency)} or more`);
    } catch (err: any) {
      setBalance(null);
      setProblem(reason(err, 'Could not check that card'));
    } finally {
      setChecking(false);
    }
  };

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (processing || disabled || !balance?.valid || applied <= 0) return;
    if (!allowPartial && !coversAll) return;
    setProcessing(true);
    setProblem('');
    try {
      const result = await client.processRequest('post', 'client/giftcards/redeem', {
        code: code.trim(),
        pin: pin.trim() || undefined,
        amount: applied,
        orderNumber: orderNumber || metadata?.orderNumber || metadata?.invoiceNumber || 'checkout',
        idempotencyKey,
        context: { orderTotal: amount.amount, channel: metadata?.channel || 'checkout' },
      });
      if (!result?.success || !result?.transactionId) throw new Error(result?.message || 'The card could not be redeemed');
      onSuccess({
        success: true,
        payment_intent_id: result.transactionId,
        transaction_id: result.transactionId,
        metadata: {
          gateway: 'giftcard',
          method: 'gift-card',
          giftCardSerial: result.serial,
          amountRedeemed: result.amountRedeemed,
          remainingBalance: result.remainingBalance,
          remainderDue: Math.max(0, Math.round((amount.amount - result.amountRedeemed) * 100) / 100),
        },
      });
    } catch (err: any) {
      const message = reason(err, 'Payment failed');
      setProblem(message);
      onError(message);
    } finally {
      setProcessing(false);
    }
  };

  const onCodeChange = (value: string) => {
    setCode(value.toUpperCase());
    setBalance(null);
    setProblem('');
  };

  return (
    <div className={className}>
      {showTitle && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Pay with a gift card</h3>
          <p className="text-sm text-gray-600">Enter the code from the card or the email it came in</p>
        </div>
      )}

      <form onSubmit={pay} className="space-y-4">
        {wallet.length > 0 && (
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Your gift cards</p>
            <div className="flex flex-wrap gap-2">
              {wallet.map(c => {
                const active = code === c.data.code;
                return (
                  <button
                    key={c.sk}
                    type="button"
                    onClick={() => {
                      onCodeChange(c.data.code);
                      setPin('');
                      check(c.data.code);
                    }}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 hover:border-gray-900'}`}
                  >
                    <span className="block font-semibold">{money(c.data.balance, c.data.currency)}</span>
                    <span className={`block font-mono text-[11px] tracking-wider ${active ? 'text-gray-300' : 'text-gray-500'}`}>{c.data.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gift card code</label>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              placeholder="Code on your gift card"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={processing || checking}
              required
            />
            <button type="button" onClick={() => check()} disabled={!code.trim() || checking || processing} className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
              {checking ? 'Checking…' : 'Check'}
            </button>
          </div>
        </div>

        {(needsPin || pin) && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
                setBalance(null);
              }}
              placeholder="From the back of the card"
              className="w-48 px-3 py-2 border border-gray-300 rounded-md tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={processing || checking}
            />
          </div>
        )}

        {problem && (
          <p role="alert" className="text-sm text-red-600">
            {problem}
          </p>
        )}

        {balance?.valid && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Card balance</span>
              <span className="font-semibold text-emerald-700">{money(balance.balance, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount due</span>
              <span className="font-semibold">{money(amount.amount, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Applied from card</span>
              <span className="font-semibold">{money(applied, currency)}</span>
            </div>
            <hr className="border-gray-200" />
            <div className="flex justify-between">
              <span className="text-gray-600">{coversAll ? 'Left on card after payment' : 'Still to pay another way'}</span>
              <span className={`font-semibold ${coversAll ? 'text-emerald-700' : 'text-amber-700'}`}>{money(coversAll ? balance.balance - applied : remainderDue, currency)}</span>
            </div>
            {!coversAll && !allowPartial && <p className="text-xs text-amber-700">This card does not cover the whole order. Pay the order another way and keep the card for a later purchase.</p>}
            {!coversAll && allowPartial && <p className="text-xs text-gray-500">The card pays what it can; the remainder stays due and can be paid with another method.</p>}
          </div>
        )}

        {balance?.valid && applied > 0 && (coversAll || allowPartial) && (
          <div className="flex gap-3">
            <button type="submit" disabled={processing || disabled} className="flex-1 bg-emerald-600 text-white py-2 px-4 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
              {processing ? 'Redeeming…' : coversAll ? `Pay ${money(applied, currency)} with gift card` : `Apply ${money(applied, currency)} from gift card`}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} disabled={processing} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default GiftCardPayment;
