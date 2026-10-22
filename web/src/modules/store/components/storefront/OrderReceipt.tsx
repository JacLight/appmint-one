'use client';

// from base-app/src/components/storefront/OrderReceipt.tsx — ported verbatim; only import paths rewired.
import React from 'react';
import { showRentalDate, rentalUnit } from '@/modules/store/components/rental/dates';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Download } from 'lucide-react';
import { StripeMark, PayPalMark } from '@/modules/store/components/payment-complete/brand-marks';
// Appmint One: the look lives in modules/store/storefront.css (sf-ty) — order-receipt.css is no longer used here.
import { orderPaymentStatus } from './order-payment-status';

/**
 * A confirmed order.
 *
 * One card: what happened, where it is up to, what was bought, where it is
 * going, and what was paid. Each fact appears once — the billing address says
 * "same as shipping" instead of repeating it, and the gateway is named in the
 * summary rather than beside every line.
 */

const GATEWAY_MARK: Record<string, React.ReactNode> = {
  stripe: <StripeMark />,
  paypal: <PayPalMark />,
};

const sameAddress = (a: any, b: any): boolean => {
  if (!a || !b) return false;
  return ['name', 'street1', 'street2', 'city', 'state', 'zip', 'country'].every(
    (k) => String(a[k] ?? '').trim().toLowerCase() === String(b[k] ?? '').trim().toLowerCase(),
  );
};

const AddressLines = ({ address }: { address: any }) => (
  <p>
    {address?.name && <>{address.name}<br /></>}
    {address?.company && <>{address.company}<br /></>}
    {address?.street1 && <>{address.street1}<br /></>}
    {address?.street2 && <>{address.street2}<br /></>}
    {[address?.city, address?.state, address?.zip].filter(Boolean).join(', ')}
    {address?.country && <><br />{address.country}</>}
  </p>
);

/** How far along the order is. Anything past "paid" is the shop's business. */
const STAGES = [
  { key: 'confirmed', label: 'Confirmed', note: 'Order received', doneNote: 'Order received' },
  { key: 'processing', label: 'Processing', note: "We're preparing your order", doneNote: 'Prepared and packed' },
  { key: 'shipped', label: 'Shipped', note: "You'll get an update soon", doneNote: 'On its way to you' },
  { key: 'delivered', label: 'Delivered', note: 'We\'ll tell you when it arrives', doneNote: 'It has arrived' },
];

/** A gift card line: the shopper's chosen value rides in its "Gift card amount" option (as AppEngine reads it). */
const isGiftCardLine = (item: any) =>
  (item?.options || []).some((o: any) => String(o?.name || '').trim().toLowerCase() === 'gift card amount');

/** The newest shipment that carries a tracking number, as the customer should read it. */
const latestTracking = (order: any) => {
  const list = Array.isArray(order?.shippingInfo) ? order.shippingInfo : order?.shippingInfo ? [order.shippingInfo] : [];
  const live = list.filter((s: any) => s && (s.tracker || s.trackingNumber) && !['cancelled', 'failure'].includes(String(s.status)));
  const s = live[live.length - 1];
  if (!s) return null;
  // Carrier account names as the customer knows the carrier ("FedExDefault" → FedEx, "UPSDAP" → UPS).
  const raw = String(s.carrier || '');
  const known: Record<string, string> = { usps: 'USPS', ups: 'UPS', fedex: 'FedEx', dhl: 'DHL', canadapost: 'Canada Post' };
  const key = raw.toLowerCase().replace(/default$|dap$|express$|smartpost$|account$/g, '').replace(/[^a-z]/g, '');
  const carrier = known[key] || Object.entries(known).find(([k]) => key.startsWith(k))?.[1] || raw;
  return { carrier, number: String(s.tracker || s.trackingNumber), url: s.trackingUrl || s.publicUrl || null };
};

export function OrderReceipt({
  order,
  storePage,
  onDownloadInvoice,
}: {
  order: any;
  storePage?: string;
  onDownloadInvoice?: () => void;
}) {
  const router = useRouter();

  const currency = order?.currency || 'USD';
  const paymentStatus = orderPaymentStatus(order);
  const isPaid = paymentStatus === 'Paid';
  const money = (n: number | undefined) => {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n || 0);
    } catch {
      return `$${(n || 0).toFixed(2)}`;
    }
  };
  const when = (v?: string) => {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} at ${d.toLocaleTimeString(
      undefined,
      { hour: '2-digit', minute: '2-digit' },
    )}`;
  };

  const items: any[] = [...(order?.productItems || []), ...(order?.rentalItems || [])];

  const shipTo = order?.shippingAddress || order?.deliveryAddress;
  const billTo = order?.billingAddress;
  const billingSame = sameAddress(shipTo, billTo);

  const total = order?.amount ?? 0;
  const subtotal = (order?.productSubtotal ?? 0) + (order?.rentalSubtotal ?? 0);
  const shipping = order?.productShipping ?? order?.shippingCost ?? 0;
  const tax = (order?.productTax ?? 0) + (order?.rentalTax ?? 0) || order?.tax || 0;
  const discount = order?.discount ?? 0;
  // When shipping is waived the order carries no `originalShipping` — the
  // shipping figure it does carry IS the amount that was struck off. Requiring
  // `originalShipping` made a waived £8 print as if it had been charged, on an
  // order whose total plainly excluded it.
  const freeShipping = !!order?.freeShipping || !!order?.freeDelivery;
  const shippingWas = order?.originalShipping ?? shipping;
  const freeShippingNote =
    (order?.discounts || []).find((d: any) => d?.type === 'free_shipping')?.name || 'Free shipping applied';

  const gateway = String(order?.paymentGateway || '').toLowerCase();
  const gatewayName = gateway ? gateway.charAt(0).toUpperCase() + gateway.slice(1) : null;
  const goShopping = () => router.push(storePage ? `/${storePage}` : '/');

  // The stage reached. `shippingInfo` is the shop saying it has gone out.
  const st = String(order?.status || '').toLowerCase();
  const stageIndex = ['delivered', 'completed'].includes(st) || order?.deliveredAt
    ? 3
    : order?.shippingInfo?.length || ['shipped', 'in_transit', 'out_for_delivery'].includes(st)
      ? 2
      : ['processing'].includes(st) ? 1 : 0;
  const tracking = stageIndex >= 2 ? latestTracking(order) : null;
  // Gift cards are emailed, not shipped: an order of nothing but gift cards has no parcel to track.
  const sentNotShipped = items.length > 0 && items.every(isGiftCardLine) && !(shipping > 0);
  // Rentals are collected and brought back, not shipped: a rentals-only order shows the booking
  // (dates, pickup and return) instead of a parcel's journey, and its refundable deposit.
  const isRentalLine = (x: any) => x?.itemType === 'rental' || !!(x?.startDate && x?.endDate);
  const rentalOnly = items.length > 0 && items.every(isRentalLine);
  const rentalDeposit = Number(order?.rentalDeposit ?? order?.deposit ?? 0) || 0;
  const fulfilWord = (t?: string) => ({ pickup: 'Pick up at our location', delivery: 'Delivered to you', dropoff: 'Return to our location' } as any)[String(t || '')] || '';

  // Appmint One: the receipt reads as the last page of checkout — the same split, the
  // order summary where the bag was, and what happens next on the left.
  const first = order?.name ? String(order.name).split(' ')[0] : '';
  const lead = isPaid
    ? 'Your order is confirmed and your payment has been received.'
    : paymentStatus === 'Awaiting payment'
      ? 'Your order has been received and is awaiting payment.'
      : `Your order is confirmed. Payment status: ${paymentStatus.toLowerCase()}.`;
  const placed = when(order?.createdAt);
  const paidWith = Array.isArray(order?.payments) && order.payments.length > 0
    ? order.payments.map((p: any) => p.label || String(p.method || '').replace(/_/g, ' ')).join(' + ')
    : gatewayName;

  return (
    <div className="sf-co sf-ty">
      <div className="sf-co-main">
        <div className="sf-co-main-in">
          <header className="sf-ty-hd">
            <span className="sf-ty-tick" aria-hidden="true"><Check className="w-5 h-5" strokeWidth={2.6} /></span>
            <p className="sf-ty-eyebrow">Order #{order?.number}{placed ? ` · ${placed}` : ''}</p>
            <h1>Thank you{first ? `, ${first}` : ''}.</h1>
            <p className="sf-ty-lead">{lead}</p>
          </header>

          {rentalOnly ? (
            <p className="sf-ty-note">Your rental is booked. Bring this order number when you collect it.</p>
          ) : sentNotShipped ? (
            <p className="sf-ty-note">Each gift card is emailed to the person it is for. There is nothing to ship.</p>
          ) : (
            <ol className="sf-ty-track" style={{ ['--at' as any]: stageIndex }} aria-label="Order progress">
              {STAGES.map((stage, i) => (
                <li key={stage.key} className={i < stageIndex ? 'done' : i === stageIndex ? 'now' : ''} aria-current={i === stageIndex ? 'step' : undefined}>
                  <span className="dot" aria-hidden="true">{i <= stageIndex && <Check className="w-3 h-3" strokeWidth={3.2} />}</span>
                  <strong>{stage.label}</strong>
                  <span>{i <= stageIndex ? stage.doneNote : stage.note}</span>
                  {stage.key === 'shipped' && tracking && (
                    <span>
                      {tracking.carrier ? `${tracking.carrier} · ` : ''}
                      {tracking.url ? <a href={tracking.url} target="_blank" rel="noreferrer">{tracking.number}</a> : tracking.number}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}

          <section className="sf-ty-facts" aria-label="Order details">
            {order?.email && (
              <div>
                <h3>Contact</h3>
                <p>{order.email}</p>
              </div>
            )}
            <div>
              <h3>Payment</h3>
              <p>
                {paidWith ? <>{paidWith}<br /></> : null}
                {money(total)} · <span className={`sf-ty-pill${isPaid ? ' ok' : ''}`}>{paymentStatus}</span>
              </p>
            </div>
            {(sentNotShipped || rentalOnly) ? (
              (billTo || shipTo) && (
                <div>
                  <h3>Billing address</h3>
                  <AddressLines address={billTo || shipTo} />
                </div>
              )
            ) : (
              <>
                {shipTo && (
                  <div>
                    <h3>Shipping address</h3>
                    <AddressLines address={shipTo} />
                  </div>
                )}
                {billTo && (
                  <div>
                    <h3>Billing address</h3>
                    {/* Said once: when they match, the second copy tells the customer nothing they cannot already see. */}
                    {billingSame ? <p>Same as shipping address</p> : <AddressLines address={billTo} />}
                  </div>
                )}
              </>
            )}
          </section>

          <div className="sf-ty-actions">
            <button type="button" className="sf-btn lg" onClick={goShopping}>
              Continue shopping <ArrowRight className="w-4 h-4" />
            </button>
            {onDownloadInvoice && (
              <button type="button" className="sf-btn lg ghost" onClick={onDownloadInvoice}>
                <Download className="w-4 h-4" /> Print receipt
              </button>
            )}
          </div>

          <p className="sf-ty-help">
            Questions about this order?{' '}
            <button type="button" onClick={() => router.push('/account/support') /* Appmint One: support lives in the account */}>Contact support</button>
            {' '}or see it under <a href="/account/orders">Your orders</a>.
          </p>
        </div>
      </div>

      <aside className="sf-co-aside sf-ty-aside" aria-label="Order summary">
        <div className="sf-co-aside-in">
          <h2>Order summary</h2>
          <ul className="sf-ty-lines">
            {items.map((item, i) => (
              <li key={`${item.sku}-${i}`}>
                <span className="sf-ty-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
                  <b>{item.quantity ?? 1}</b>
                </span>
                <span className="sf-ty-line-copy">
                  <strong>{item.name}</strong>
                  {isRentalLine(item) ? (
                    <>
                      <span>{showRentalDate(item.startDate)} – {showRentalDate(item.endDate)}{item.duration ? ` · ${item.duration} ${rentalUnit(item.rentalPeriod)}${Number(item.duration) === 1 ? '' : 's'}` : ''}</span>
                      {(item.fulfillment?.type || item.return?.type) && (
                        <span>{[fulfilWord(item.fulfillment?.type), fulfilWord(item.return?.type)].filter(Boolean).join(' · ')}</span>
                      )}
                    </>
                  ) : (
                    (item.quantity ?? 1) > 1 && <span>Qty {item.quantity}</span>
                  )}
                </span>
                <span className="sf-ty-amt">{money(item.amount ?? item.lineTotal ?? item.price)}</span>
              </li>
            ))}
          </ul>

          <dl className="sf-ty-sums">
            {subtotal > 0 && (
              <div><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
            )}
            {discount > 0 && (
              <div><dt>{order?.discountCode ? `Discount · ${order.discountCode}` : 'Discount'}</dt><dd className="save">−{money(discount)}</dd></div>
            )}
            {(shipping > 0 || freeShipping) && (
              <div>
                <dt>Shipping{freeShipping && <small>{freeShippingNote}</small>}</dt>
                <dd>
                  {freeShipping ? (
                    <>{shippingWas > 0 && <s>{money(shippingWas)}</s>} <span className="save">Free</span></>
                  ) : money(shipping)}
                </dd>
              </div>
            )}
            {tax > 0 && (
              <div><dt>Tax</dt><dd>{money(tax)}</dd></div>
            )}
            {rentalDeposit > 0 && (
              <div><dt>Deposit (refundable)</dt><dd>{money(rentalDeposit)}</dd></div>
            )}
            <div className="grand"><dt>Total</dt><dd><small>{currency}</small>{money(total)}</dd></div>
            {Array.isArray(order?.payments) && order.payments.length > 0 && order.payments.map((p: any, i: number) => (
              // Every tender the order was paid with — a gift card and a card for the rest are two lines, as on a statement.
              <div key={`${p.method}-${i}`} className="paid"><dt>Paid with {p.label || String(p.method || '').replace(/_/g, ' ')}</dt><dd>{money(p.amount)}</dd></div>
            ))}
            {Number(order?.totalRefunded) > 0 && (
              <div className="paid"><dt>Refunded</dt><dd>-{money(Number(order.totalRefunded))}</dd></div>
            )}
          </dl>
        </div>
      </aside>
    </div>
  );
}

export default OrderReceipt;
