'use client';

// from base-app/src/components/storefront/store-credit/CheckoutStoreCredit.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import type { CheckoutWalletChoice } from '@/modules/store/store/cart-store';

/** The shopper's store credit and points as the cart summary reports them: what they hold and what would be used. */
export interface CheckoutWalletSummary {
  storeCreditBalance: number;
  pointsBalance: number;
  /** Points per 1.00. */
  redemptionRate: number;
  currency?: string;
  storeCreditApplied: number;
  pointsApplied: number;
  /** Money the applied points cover. */
  pointsValue: number;
  problem?: string;
}

const money = (v: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v) || 0);
const count = (v: number) => new Intl.NumberFormat('en-US').format(Number(v) || 0);
const typed = (v: number | 'max' | undefined) => (typeof v === 'number' ? String(v) : '');

/**
 * Store credit and reward points at checkout, for a signed-in shopper the
 * server says has a wallet.
 *
 * Like a gift card, choosing to use them only asks the server what they would
 * cover; nothing comes off either balance until the order is placed. What is
 * used — and what is left for a card — is the cart summary's, shown as it comes
 * back. Each is off until the shopper turns it on; on means "all that helps"
 * unless they enter a smaller amount.
 */
export function CheckoutStoreCredit({
  wallet,
  walletTotal,
  amountDue,
  choice,
  loading,
  onChange,
}: {
  wallet: CheckoutWalletSummary;
  walletTotal?: number;
  amountDue?: number;
  choice?: CheckoutWalletChoice;
  loading?: boolean;
  onChange: (choice: CheckoutWalletChoice) => void;
}) {
  const currency = wallet.currency || 'USD';
  const useCredit = choice?.storeCredit !== undefined;
  const usePoints = choice?.points !== undefined;
  const [open, setOpen] = useState(useCredit || usePoints);
  const [creditEntry, setCreditEntry] = useState(typed(choice?.storeCredit));
  const [pointsEntry, setPointsEntry] = useState(typed(choice?.points));

  // A choice restored from the saved checkout (back from a card redirect) shows as typed.
  useEffect(() => setCreditEntry(typed(choice?.storeCredit)), [choice?.storeCredit]);
  useEffect(() => setPointsEntry(typed(choice?.points)), [choice?.points]);

  const set = (next: CheckoutWalletChoice) => {
    const clean: CheckoutWalletChoice = {};
    if (next.storeCredit !== undefined) clean.storeCredit = next.storeCredit;
    if (next.points !== undefined) clean.points = next.points;
    onChange(clean);
  };

  const applyCredit = () => {
    const n = Math.round(Number(creditEntry) * 100) / 100;
    set({ ...choice, storeCredit: creditEntry.trim() && n > 0 ? n : 'max' });
  };
  const applyPoints = () => {
    const n = Math.floor(Number(pointsEntry));
    set({ ...choice, points: pointsEntry.trim() && n > 0 ? n : 'max' });
  };

  const hasCredit = wallet.storeCreditBalance > 0 || useCredit;
  const hasPoints = wallet.pointsBalance > 0 || usePoints;

  return (
    <div className="rounded-xl border border-slate-200">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-3">
          <IconRenderer icon="Wallet" className="h-5 w-5 text-slate-500" />
          <span className="font-medium text-slate-900">Store credit & points</span>
          {!!walletTotal && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">−{money(walletTotal, currency)}</span>}
        </span>
        <IconRenderer icon={open ? 'ChevronUp' : 'ChevronDown'} className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4">
          {hasCredit && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useCredit}
                    onChange={e => set({ ...choice, storeCredit: e.target.checked ? 'max' : undefined })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-900">Use store credit</span>
                </span>
                <span className="text-slate-500">{money(wallet.storeCreditBalance, currency)} available</span>
              </label>
              {useCredit && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pl-7">
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      applyCredit();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={creditEntry}
                      onChange={e => setCreditEntry(e.target.value)}
                      placeholder="All that helps"
                      aria-label="Store credit to use"
                      className="w-36 rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                    />
                    <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white">
                      Apply
                    </button>
                  </form>
                  {loading ? (
                    <span className="text-slate-400">Checking…</span>
                  ) : (
                    <span className="font-semibold text-slate-900">−{money(wallet.storeCreditApplied, currency)}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {hasPoints && (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
              <label className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={usePoints}
                    onChange={e => set({ ...choice, points: e.target.checked ? 'max' : undefined })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="font-medium text-slate-900">Use reward points</span>
                </span>
                <span className="text-right text-slate-500">
                  {count(wallet.pointsBalance)} points
                  {wallet.redemptionRate > 0 && <span className="block text-xs">{count(wallet.redemptionRate)} points = {money(1, currency)}</span>}
                </span>
              </label>
              {usePoints && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pl-7">
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      applyPoints();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={pointsEntry}
                      onChange={e => setPointsEntry(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder="All that helps"
                      aria-label="Points to use"
                      className="w-36 rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-900"
                    />
                    <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white">
                      Apply
                    </button>
                  </form>
                  {loading ? (
                    <span className="text-slate-400">Checking…</span>
                  ) : (
                    <span className="font-semibold text-slate-900">
                      −{money(wallet.pointsValue, currency)}
                      <span className="ml-2 font-normal text-slate-500">{count(wallet.pointsApplied)} points</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {wallet.problem && <p className="text-sm text-red-600">{wallet.problem}</p>}

          {!!walletTotal && amountDue !== undefined && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <span className="text-slate-600">{amountDue > 0 ? 'Left to pay by card' : 'Nothing left to pay'}</span>
              <span className="font-semibold text-slate-900">{money(amountDue, currency)}</span>
            </div>
          )}
          <p className="text-xs text-slate-500">Nothing comes off your store credit or points until you place the order.</p>
        </div>
      )}
    </div>
  );
}

export default CheckoutStoreCredit;
