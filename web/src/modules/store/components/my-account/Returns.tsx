'use client';

// from base-app/src/components/my-account/Returns.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { SlidePanel } from './components/SlidePanel';
import { returnsService } from '@/modules/store/services/returns-service';
import { RETURN_STATUS, canCancelReturn, canMarkShipped, serverWords } from './returns-view';

/** Carrier values the return form stores, as people say them. */
const CARRIER_NAMES: Record<string, string> = { usps: 'USPS', ups: 'UPS', fedex: 'FedEx', dhl: 'DHL', other: 'Other carrier' };

const money = (v: any) => `$${(Number(v) || 0).toFixed(2)}`;
const when = (v?: string) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

type Panel = { kind: 'ship' | 'cancel'; rma: any } | null;

/** The store's reason for declining: the note on the timeline's "rejected" step. */
const rejectionNote = (d: any): string => [...(d.timeline || [])].reverse().find((t: any) => t?.status === 'rejected')?.note || '';

/** My returns (F-SF-RET-014): each RMA with its status, and what the customer can do next. */
export function Returns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);

  const load = async () => {
    try {
      setReturns(await returnsService.myReturns());
      setLoadFailed('');
    } catch (err) {
      setLoadFailed(serverWords(err, 'Your returns could not be loaded'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Returns</h1>
        <p className="text-gray-600">Returns you have asked for. To start a new one, open the order under Orders and choose &quot;Request a return&quot;.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading your returns…</p>
      ) : loadFailed ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadFailed}{' '}
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Try again
          </button>
        </div>
      ) : returns.length === 0 ? (
        <div className="rounded-xl bg-white py-12 text-center shadow-sm">
          <IconRenderer icon="RotateCcw" className="mx-auto mb-4 h-12 w-12 text-gray-300" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No returns</h3>
          <p className="text-gray-500">
            You haven&apos;t asked to return anything.{' '}
            <a href="/account/orders" className="text-blue-600 hover:text-blue-700">
              Go to your orders
            </a>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {returns.map((r: any) => {
            const d = r.data || r;
            const st = RETURN_STATUS[d.status] || { label: d.status, cls: 'bg-gray-100 text-gray-700', note: '' };
            const expanded = open === d.rmaNumber;
            return (
              <div key={r.sk || d.rmaNumber} className="rounded-xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{d.rmaNumber}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Order {d.orderNumber} · {when(d.requestedDate || r.createdate)} · {((n) => `${n} ${n === 1 ? 'item' : 'items'}`)((d.items || []).reduce((s: number, it: any) => s + (Number(it.returnQuantity) || 0), 0))} · {money(d.refundAmount)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${st.cls}`}>{st.label}</span>
                </div>
                {st.note && <p className="mt-3 text-sm text-gray-600">{d.status === 'approved' && d.shippingLabel?.paidBy === 'store' ? (d.shippingLabel?.labelUrl ? 'The store has paid for the return label below: print it, put it on the parcel and send it, then tell us it is on its way.' : 'The store has paid for your return label (below). Send the parcel with it, then tell us it is on its way.') : st.note}</p>}
                {d.status === 'rejected' && rejectionNote(d) && <p className="mt-1 text-sm text-gray-600">Reason: {rejectionNote(d)}</p>}
                {d.status === 'approved' && d.returnAddress && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    <p className="font-medium text-gray-900">Send it to</p>
                    <p>{d.returnAddress.name}</p>
                    <p>{d.returnAddress.street}</p>
                    <p>{[d.returnAddress.city, d.returnAddress.state, d.returnAddress.postalCode].filter(Boolean).join(', ')}</p>
                    <p>{d.returnAddress.country}</p>
                  </div>
                )}
                {d.shippingLabel?.trackingNumber && (
                  <p className="mt-2 text-sm text-gray-600">
                    {d.status === 'approved' ? 'Return label' : 'Sent with'} {CARRIER_NAMES[String(d.shippingLabel.carrier || '').toLowerCase()] || d.shippingLabel.carrier}: {d.shippingLabel.trackingNumber}
                    {d.shippingLabel.labelUrl && (
                      <>
                        {' · '}
                        <a href={d.shippingLabel.labelUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                          Print label
                        </a>
                      </>
                    )}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {canMarkShipped(d.status) && (
                    <button type="button" onClick={() => setPanel({ kind: 'ship', rma: d })} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
                      Mark as shipped
                    </button>
                  )}
                  {canCancelReturn(d.status) && (
                    <button type="button" onClick={() => setPanel({ kind: 'cancel', rma: d })} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-gray-900">
                      Cancel return
                    </button>
                  )}
                  <button type="button" onClick={() => setOpen(expanded ? null : d.rmaNumber)} className="ml-auto inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
                    {expanded ? 'Hide details' : 'Details'}
                    <IconRenderer icon={expanded ? 'ChevronUp' : 'ChevronDown'} className="h-4 w-4" />
                  </button>
                </div>

                {expanded && (
                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-600">
                    <ul className="space-y-1">
                      {(d.items || []).map((it: any, i: number) => (
                        <li key={`${it.sku}-${i}`} className="flex justify-between gap-4">
                          <span>
                            {it.name} × {it.returnQuantity}
                          </span>
                          <span>{money((Number(it.price) || 0) * (Number(it.returnQuantity) || 0))}</span>
                        </li>
                      ))}
                    </ul>
                    {d.reason && <p>Why: {d.reason}</p>}
                    {(d.timeline || []).length > 0 && (
                      <ul className="space-y-1 text-xs text-gray-500">
                        {(d.timeline || []).map((t: any, i: number) => (
                          <li key={i}>
                            {when(t.date)} · {(RETURN_STATUS[t.status] || { label: t.status }).label}
                            {t.note ? ` · ${t.note}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SlidePanel isOpen={!!panel} onClose={() => setPanel(null)} title={panel?.kind === 'ship' ? 'Mark as shipped' : 'Cancel return'} width="520px">
        {panel && (
          <ActionForm
            panel={panel}
            onDone={async () => {
              setPanel(null);
              await load();
            }}
          />
        )}
      </SlidePanel>
    </div>
  );
}

function ActionForm({ panel, onDone }: { panel: NonNullable<Panel>; onDone: () => void }) {
  // a prepaid label the store bought already names the carrier and tracking number: start from it (returns course, 11 Oct)
  const label = panel.kind === 'ship' && panel.rma?.shippingLabel?.paidBy === 'store' ? panel.rma.shippingLabel : null;
  const [carrier, setCarrier] = useState<string>(label?.carrier || '');
  const [tracking, setTracking] = useState<string>(label?.trackingNumber || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const ship = panel.kind === 'ship';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setProblem('');
    try {
      if (ship) await returnsService.markShipped(panel.rma.rmaNumber, carrier.trim(), tracking.trim());
      else await returnsService.cancel(panel.rma.rmaNumber, reason.trim() || 'Cancelled by the customer');
      onDone();
    } catch (err) {
      setProblem(serverWords(err, ship ? 'Could not mark it as shipped' : 'Could not cancel the return'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 p-6">
      <p className="text-sm text-gray-600">
        Return <span className="font-medium text-gray-900">{panel.rma.rmaNumber}</span> for order {panel.rma.orderNumber}.
      </p>
      {ship ? (
        <>
          <div>
            <label htmlFor="ret-carrier" className="mb-1 block text-sm font-medium text-gray-700">
              Carrier
            </label>
            {/* The same carriers staff pick from in the Order Center, so the store reads one name, not typed variants. */}
            <select id="ret-carrier" required value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-900">
              <option value="">Choose a carrier</option>
              <option value="usps">USPS</option>
              <option value="ups">UPS</option>
              <option value="fedex">FedEx</option>
              <option value="dhl">DHL</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="ret-tracking" className="mb-1 block text-sm font-medium text-gray-700">
              Tracking number
            </label>
            <input id="ret-tracking" required value={tracking} onChange={(e) => setTracking(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
          </div>
        </>
      ) : (
        <div>
          <label htmlFor="ret-cancel-reason" className="mb-1 block text-sm font-medium text-gray-700">
            Why are you cancelling? (optional)
          </label>
          <textarea id="ret-cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-gray-900" />
          <p className="mt-2 text-xs text-gray-500">Cancelling withdraws the return. If you have already sent the items, contact the store instead.</p>
        </div>
      )}
      {problem && (
        <p role="alert" className="text-sm text-red-600">
          {problem}
        </p>
      )}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
        {busy ? 'Saving…' : ship ? 'Save tracking' : 'Cancel this return'}
      </button>
    </form>
  );
}

export default Returns;
