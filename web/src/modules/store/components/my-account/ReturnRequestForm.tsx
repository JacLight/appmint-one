'use client';

// from base-app/src/components/my-account/ReturnRequestForm.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { returnsService } from '@/modules/store/services/returns-service';
import { RETURN_CONDITIONS, RETURN_REASONS, ReturnableLine, buildReturnRequest, conditionForReason, returnableLines, serverWords } from './returns-view';

/** "Request a return" on one of the customer's orders (F-SF-RET-014). */
export function ReturnRequestForm({ order, onDone }: { order: any; onDone: () => void }) {
  const od = order?.data || order || {};
  const [lines, setLines] = useState<ReturnableLine[] | null>(null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reasonCategory, setReasonCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [created, setCreated] = useState<any>(null);

  useEffect(() => {
    let live = true;
    returnsService
      .myReturns()
      .catch(() => [])
      .then((existing) => {
        if (live) setLines(returnableLines(order, existing));
      });
    return () => {
      live = false;
    };
  }, [order]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lines) return;
    const built = buildReturnRequest(order, lines, picked, reasonCategory, details, condition);
    if (built.ok === false) {
      setProblem(built.problem);
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      setCreated(await returnsService.requestReturn(built.body));
    } catch (err) {
      setProblem(serverWords(err, 'The return could not be requested'));
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const rd = created?.data || created || {};
    return (
      <div className="space-y-4 p-6">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <IconRenderer icon="Check" className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Return requested</h3>
        <p className="text-sm text-gray-600">
          Your return <span className="font-medium text-gray-900">{rd.rmaNumber}</span> for order {od.number} is with the store. You will hear back once they review it.
          {Number(rd.refundAmount) > 0 && <> Items worth ${Number(rd.refundAmount).toFixed(2)} at the order&apos;s prices.</>}
        </p>
        <div className="flex gap-3">
          <a href="/account/returns" className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
            View my returns
          </a>
          <button type="button" onClick={onDone} className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:border-gray-900">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 p-6">
      <p className="text-sm text-gray-600">Choose what you are sending back from order {od.number}. Returns are open for 30 days after the order.</p>

      {!lines ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="divide-y divide-gray-200 rounded-lg bg-gray-50">
          {lines.map((l) => (
            <div key={l.sku} className="flex items-center gap-4 p-4">
              {l.image ? <img src={l.image} alt={l.name} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gray-900">{l.name}</p>
                <p className="text-xs text-gray-500">
                  {l.left > 0 ? `${l.left} of ${l.bought} can be returned` : 'Already returned or on a return'}
                </p>
              </div>
              <label className="sr-only" htmlFor={`ret-qty-${l.sku}`}>
                How many {l.name} to return
              </label>
              <input
                id={`ret-qty-${l.sku}`}
                aria-label={`Return quantity for ${l.name}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={l.left}
                step={1}
                disabled={l.left === 0}
                value={picked[l.sku] ?? ''}
                onChange={(e) => setPicked((p) => ({ ...p, [l.sku]: Number(e.target.value) }))}
                placeholder="0"
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 disabled:bg-gray-100"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <label htmlFor="ret-reason" className="mb-1 block text-sm font-medium text-gray-700">
          Why are you returning it?
        </label>
        <select
          id="ret-reason"
          value={reasonCategory}
          onChange={(e) => {
            setReasonCategory(e.target.value);
            if (e.target.value) setCondition(conditionForReason(e.target.value));
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
        >
          <option value="">Choose a reason</option>
          {RETURN_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {reasonCategory && (
        <div>
          <label htmlFor="ret-condition" className="mb-1 block text-sm font-medium text-gray-700">
            What condition is it in?
          </label>
          <select
            id="ret-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
          >
            {RETURN_CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="ret-details" className="mb-1 block text-sm font-medium text-gray-700">
          Anything the store should know (optional)
        </label>
        <textarea
          id="ret-details"
          rows={3}
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
          className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
        />
      </div>

      {problem && (
        <p role="alert" className="text-sm text-red-600">
          {problem}
        </p>
      )}

      <button type="submit" disabled={busy || !lines} className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
        {busy ? 'Sending…' : 'Request return'}
      </button>
    </form>
  );
}

export default ReturnRequestForm;
