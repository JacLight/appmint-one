'use client';

// from base-app/src/components/storefront/gift-card/CheckoutGiftCards.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { giftCardService, type CustomerGiftCard } from '@/modules/store/services/gift-card-service';
import { setGiftCardPin } from './checkout-gift-cards';

/** One card as the cart summary reports it: what it would pay, what it keeps, or why it cannot. */
export interface AppliedGiftCard {
  code: string;
  currency?: string;
  balance: number;
  applied: number;
  balanceAfter: number;
  problem?: string;
  needsPin?: boolean;
}

const money = (v: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v) || 0);
const tail = (code: string) => code.replace(/[^A-Z0-9]/gi, '').slice(-4);

/**
 * Gift cards at checkout.
 *
 * Applying a card only asks the server what it would cover; nothing comes off
 * it until the order is placed, so a shopper who changes their mind keeps every
 * cent. The split — what each card pays, what it keeps, what is still due — is
 * the cart summary's, shown as it comes back. Several cards can be applied, and
 * whatever they leave is paid by card below.
 */
export function CheckoutGiftCards({
  codes,
  cards,
  giftCardTotal,
  amountDue,
  currency = 'USD',
  loading,
  signedIn,
  note,
  onChange,
}: {
  codes: string[];
  cards?: AppliedGiftCard[];
  giftCardTotal?: number;
  amountDue?: number;
  currency?: string;
  loading?: boolean;
  signedIn?: boolean;
  /** The server's word on value the cards cannot cover (a gift card cannot buy a gift card). */
  note?: string;
  onChange: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(codes.length > 0);
  const [entry, setEntry] = useState('');
  const [pins, setPins] = useState<Record<string, string>>({});
  const [wallet, setWallet] = useState<CustomerGiftCard[]>([]);

  // A signed-in shopper's own cards, to tap instead of typing. Only the ones
  // that are theirs to spend — never a card they bought for someone else.
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    giftCardService.getMyCards().then(dto => {
      if (alive) setWallet(dto.data.filter(c => c.holder !== false && c.data.status === 'active' && c.data.balance > 0));
    });
    return () => {
      alive = false;
    };
  }, [signedIn]);

  const add = (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!code || codes.includes(code)) return;
    onChange([...codes, code]);
    setEntry('');
  };
  const remove = (code: string) => {
    setGiftCardPin(code, '');
    onChange(codes.filter(c => c !== code));
  };
  const submitPin = (code: string) => {
    setGiftCardPin(code, (pins[code] || '').trim());
    onChange([...codes]); // same cards, asked again with the PIN
  };

  const byCode = new Map((cards || []).map(c => [c.code, c]));
  const unused = wallet.filter(w => !codes.includes(w.data.code));

  return (
    <div className="rounded-xl border border-slate-200">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <IconRenderer icon="Gift" className="h-5 w-5 text-slate-500" />
          <span className="font-medium text-slate-900">Gift card</span>
          {!!giftCardTotal && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">−{money(giftCardTotal, currency)}</span>}
        </span>
        <IconRenderer icon={open ? 'ChevronUp' : 'ChevronDown'} className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          {codes.length > 0 && (
            <ul className="space-y-2">
              {codes.map(code => {
                const c = byCode.get(code);
                return (
                  <li key={code} className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono tracking-wider text-slate-700">•••• {tail(code)}</span>
                      <span className="flex items-center gap-3">
                        {c && !c.problem && (
                          <span className="font-semibold text-slate-900">
                            −{money(c.applied, c.currency || currency)}
                            <span className="ml-2 font-normal text-slate-500">{money(c.balanceAfter, c.currency || currency)} left on card</span>
                          </span>
                        )}
                        {!c && loading && <span className="text-slate-400">Checking…</span>}
                        <button type="button" onClick={() => remove(code)} className="text-slate-400 hover:text-slate-900" aria-label={`Remove card ending ${tail(code)}`}>
                          <IconRenderer icon="X" className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                    {c?.problem && <p className="mt-1 text-red-600">{c.problem}</p>}
                    {c?.needsPin && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          value={pins[code] || ''}
                          onChange={e => setPins({ ...pins, [code]: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submitPin(code);
                            }
                          }}
                          placeholder="PIN from the back"
                          className="w-40 rounded-md border border-slate-300 px-3 py-2 tracking-widest outline-none focus:border-slate-900"
                        />
                        <button type="button" onClick={() => submitPin(code)} disabled={!pins[code]} className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
                          Use PIN
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {unused.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">Your cards</p>
              <div className="flex flex-wrap gap-2">
                {unused.map(w => (
                  <button key={w.sk} type="button" onClick={() => add(w.data.code)} className="rounded-lg border border-slate-300 px-3 py-2 text-left text-sm hover:border-slate-900">
                    <span className="block font-semibold">{money(w.data.balance, w.data.currency)}</span>
                    <span className="block font-mono text-[11px] tracking-wider text-slate-500">•••• {tail(w.data.code)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={e => {
              e.preventDefault();
              add(entry);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              autoComplete="off"
              value={entry}
              onChange={e => setEntry(e.target.value.toUpperCase())}
              placeholder="Gift card code"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono tracking-wider outline-none focus:border-slate-900"
            />
            <button type="submit" disabled={!entry.trim()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Apply
            </button>
          </form>

          {!!giftCardTotal && amountDue !== undefined && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-600">{amountDue > 0 ? 'Left to pay by card' : 'Nothing left to pay'}</span>
              <span className="font-semibold text-slate-900">{money(amountDue, currency)}</span>
            </div>
          )}
          {note && codes.length > 0 && <p className="text-sm text-amber-700">{note}</p>}
          <p className="text-xs text-slate-500">Nothing is taken off a card until you place the order.</p>
        </div>
      )}
    </div>
  );
}

export default CheckoutGiftCards;
