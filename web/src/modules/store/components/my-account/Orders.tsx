'use client';
// from base-app/src/components/my-account/Orders.tsx — ported verbatim; only import paths rewired.
import React, { useState } from 'react';
import { showRentalDate, rentalUnit } from '@/modules/store/components/rental/dates';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { SlidePanel } from './components/SlidePanel';
import { MyAccountData } from './types';
import { ReturnRequestForm } from './ReturnRequestForm';
import { orderCanRequestReturn } from './returns-view';

interface OrdersProps {
  data: MyAccountData;
}

// Helper to get all items from an order (products + rentals)
const getAllItems = (orderData: any) => [
  ...(orderData?.productItems || []),
  ...(orderData?.rentalItems || []),
];

// Helper to get address display name
const getAddressName = (addr: any) => {
  if (!addr) return '';
  if (addr.name) return addr.name;
  return [addr.firstName, addr.lastName].filter(Boolean).join(' ');
};

// Helper to get address street
const getAddressStreet = (addr: any) => addr?.street1 || addr?.address1 || '';
const getAddressStreet2 = (addr: any) => addr?.street2 || addr?.address2 || '';
const getAddressZip = (addr: any) => addr?.zip || addr?.postalCode || '';

// All possible order statuses from schema
const ORDER_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'awaiting-payment', label: 'Awaiting Payment' },
  { value: 'paid-partial', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'partially-shipped', label: 'Partially Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'partially-delivered', label: 'Partially Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'returned', label: 'Returned' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'cancelled', label: 'Cancelled' },
];

// The server writes some statuses with underscores (partially_refunded, in_transit); read both spellings.
const getStatusLabel = (status: string) => {
  const s = String(status || '');
  const dashed = s.replace(/_/g, '-');
  if (dashed === 'partially-refunded') return 'Partially Refunded';
  return ORDER_STATUSES.find((x) => x.value === s || x.value === dashed)?.label || (s.charAt(0).toUpperCase() + s.slice(1)).replace(/[-_]/g, ' ');
};

/** How the order was paid, in words: the method of its first payment, else the gateway. */
const PAYMENT_WORDS: Record<string, string> = { bank_transfer: 'Bank transfer', cash: 'Cash', check: 'Check', card: 'Card', stripe: 'Card', giftcard: 'Gift card', gift_card: 'Gift card', manual: 'Recorded by the store', other: 'Other' };
const paymentLabel = (od: any) => {
  const method = String(od?.payments?.[0]?.method || od?.paymentGateway || '').toLowerCase();
  return PAYMENT_WORDS[method] || method.replace(/_/g, ' ');
};
// Appmint One: amounts read as money ($2,164.00), not bare decimals.
const usd = (n: any) => Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Appmint One: how a status reads at a glance — done, moving, waiting or stopped. */
const statusTone = (status: string) => {
  const s = String(status || '').replace(/_/g, '-');
  if (['paid', 'confirmed', 'delivered', 'completed'].includes(s)) return 'ok';
  if (['processing', 'shipped', 'partially-shipped', 'partially-delivered'].includes(s)) return 'go';
  if (['failed', 'cancelled', 'refunded', 'returned', 'partially-refunded'].includes(s)) return 'stop';
  return 'wait';
};
const CARRIER_WORDS: Record<string, string> = { ups: 'UPS', usps: 'USPS', fedex: 'FedEx', dhl: 'DHL' };
const carrierLabel = (c: any) => CARRIER_WORDS[String(c || '').toLowerCase()] || c;

const getStatusIcon = (status: string) => {
  const map: Record<string, string> = {
    new: 'Clock',
    'awaiting-payment': 'CreditCard',
    'paid-partial': 'DollarSign',
    paid: 'CheckCircle',
    confirmed: 'CheckCircle',
    processing: 'Package',
    shipped: 'Truck',
    'partially-shipped': 'Truck',
    delivered: 'Check',
    'partially-delivered': 'Check',
    completed: 'CheckCircle',
    failed: 'AlertCircle',
    returned: 'CornerDownLeft',
    refunded: 'RotateCcw',
    cancelled: 'X',
  };
  return map[status] || 'Package';
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    new: 'bg-gray-100 text-gray-700',
    'awaiting-payment': 'bg-amber-100 text-amber-700',
    'paid-partial': 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-700',
    confirmed: 'bg-blue-100 text-blue-700',
    processing: 'bg-yellow-100 text-yellow-700',
    shipped: 'bg-blue-100 text-blue-700',
    'partially-shipped': 'bg-blue-100 text-blue-700',
    delivered: 'bg-green-100 text-green-700',
    'partially-delivered': 'bg-green-100 text-green-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    returned: 'bg-orange-100 text-orange-700',
    refunded: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

export const Orders: React.FC<OrdersProps> = ({ data }) => {
  const orders = data?.orders || [];
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [returnFor, setReturnFor] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredOrders = orders?.filter((order: any) => {
    const orderData = order.data || order;
    const orderNumber = orderData?.number || '';
    const allItems = getAllItems(orderData);
    const orderStatus = orderData?.status || '';

    const matchesSearch =
      orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (orderData?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      allItems.some((item: any) => item?.name?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || orderStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const formatDateLong = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const AddressBlock = ({ addr, label, icon }: { addr: any; label: string; icon: string }) => {
    if (!addr) return null;
    const name = getAddressName(addr);
    const street = getAddressStreet(addr);
    const street2 = getAddressStreet2(addr);
    const zip = getAddressZip(addr);

    return (
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">{label}</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <IconRenderer icon={icon} className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="text-sm text-gray-600">
              {name && <p className="font-medium text-gray-900">{name}</p>}
              {street && <p>{street}</p>}
              {street2 && <p>{street2}</p>}
              <p>
                {[addr.city, addr.state, zip].filter(Boolean).join(', ')}
              </p>
              {addr.country && <p>{addr.country}</p>}
              {addr.phone && <p className="mt-2">{addr.phone}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const OrderDetails = () => {
    if (!selectedOrder) return null;
    const od = selectedOrder.data || selectedOrder;
    const allItems = getAllItems(od);
    const productItems = od.productItems || [];
    const rentalItems = od.rentalItems || [];
    const shipments = od.shippingInfo || [];

    return (
      <SlidePanel
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order ${od.number || 'Details'}`}
      >
        <div className="p-6 space-y-6 sf-ordp">
          {/* Order Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Order Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Order Number</span>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{od.number || 'N/A'}</span>
                    <button onClick={() => copyToClipboard(od.number || '')} className="text-gray-400 hover:text-gray-600">
                      <IconRenderer icon="Copy" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date Placed</span>
                  <span className="font-medium text-gray-900">
                    {formatDateLong(selectedOrder.createdate || od.createdate || '')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(od.status || 'new')}`}>
                    <IconRenderer icon={getStatusIcon(od.status || 'new')} className="w-3 h-3 mr-1" />
                    {getStatusLabel(od.status || 'new')}
                  </span>
                </div>
                {od.orderType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order Type</span>
                    <span className="font-medium text-gray-900 capitalize">{od.orderType}</span>
                  </div>
                )}
                {od.paymentGateway && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment</span>
                    <span className="font-medium text-gray-900">{paymentLabel(od)}</span>
                  </div>
                )}
                {od.remarks && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Remarks</span>
                    <span className="font-medium text-gray-900">{od.remarks}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Info */}
            {shipments.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Shipping</h3>
                <div className="space-y-3">
                  {shipments.map((ship: any, idx: number) => (
                    <div key={idx} className="space-y-2 text-sm">
                      {shipments.length > 1 && (
                        <p className="text-xs font-semibold text-gray-500 uppercase">Shipment {idx + 1}</p>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Carrier</span>
                        <span className="font-medium text-gray-900">{carrierLabel(ship.carrier)} {ship.service || ship.rate || ''}</span>
                      </div>
                      {ship.tracker && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tracking</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 text-xs">{ship.tracker}</span>
                            <button onClick={() => copyToClipboard(ship.tracker)} className="text-gray-400 hover:text-gray-600">
                              <IconRenderer icon="Copy" className="w-3 h-3" />
                            </button>
                            {ship.trackingUrl && (
                              <a href={ship.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                                <IconRenderer icon="ExternalLink" className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                      {ship.status && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status</span>
                          <span className="font-medium text-gray-900 capitalize">{ship.status.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {ship.shippedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shipped</span>
                          <span className="font-medium text-gray-900">{formatDate(ship.shippedAt)}</span>
                        </div>
                      )}
                      {ship.products && ship.products.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          Items: {ship.products.map((p: any) => `${p.name} (×${p.quantity})`).join(', ')}
                        </div>
                      )}
                      {idx < shipments.length - 1 && <hr className="border-gray-200" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Product Items */}
          {productItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                Products ({productItems.length})
              </h3>
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {productItems.map((item: any, idx: number) => (
                  <div key={item.sku || idx} className="p-4 flex items-center space-x-4">
                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                      <div className="mt-1 text-sm text-gray-500">
                        <span>{usd((item.unitPrice || 0))}/ea × {item.quantity}</span>
                      </div>
                      {item.options && item.options.length > 0 && (
                        <div className="mt-1 text-xs text-gray-500">
                          {item.options.map((opt: any) => `${opt.name}: ${opt.value}`).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900">{usd((item.amount || (item.unitPrice || 0) * item.quantity))}</p>
                      {item.discount > 0 && (
                        <p className="text-xs text-emerald-600">-{usd((item.discount ?? 0))}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rental Items */}
          {rentalItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                Rentals ({rentalItems.length})
              </h3>
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {rentalItems.map((item: any, idx: number) => (
                  <div key={item.sku || idx} className="p-4">
                    <div className="flex items-center space-x-4">
                      <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">{item.name}</h4>
                        {item.startDate && item.endDate && (
                          <p className="mt-1 text-xs text-blue-600 flex items-center">
                            <IconRenderer icon="Calendar" className="w-3 h-3 mr-1" />
                            {showRentalDate(item.startDate, { month: 'short', day: 'numeric', year: 'numeric' })} - {showRentalDate(item.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                        {item.unitPrice && item.rentalPeriod && item.duration && (
                          <p className="mt-1 text-sm text-gray-500">
                            {usd((item.unitPrice ?? 0))}/{rentalUnit(item.rentalPeriod)} × {item.duration}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">{usd((item.amount || 0))}</p>
                      </div>
                    </div>
                    {/* Fees */}
                    {item.fees && item.fees.length > 0 && (
                      <div className="mt-2 ml-20 space-y-1 text-xs">
                        {item.fees.map((fee: any, feeIdx: number) => (
                          <div key={feeIdx} className="flex justify-between text-gray-500">
                            <span>{fee.name}</span>
                            <span>{usd((fee.amount || 0))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {item.deposit > 0 && (
                      <div className="mt-1 ml-20 flex justify-between text-xs text-amber-600">
                        <span>Deposit (refundable)</span>
                        <span>{usd((item.deposit ?? 0))}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Addresses */}
          {(od.shippingAddress || od.billingAddress) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AddressBlock addr={od.shippingAddress} label="Shipping Address" icon="MapPin" />
              <AddressBlock addr={od.billingAddress} label="Billing Address" icon="CreditCard" />
            </div>
          )}

          {/* Order Summary */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2 text-sm">
                {/* Product totals */}
                {productItems.length > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Products Subtotal</span>
                      <span className="font-medium text-gray-900">{usd((od.productSubtotal || 0))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium text-gray-900">
                        {od.freeShipping ? (
                          <span className="text-emerald-600">Free</span>
                        ) : (
                          `${usd((od.productShipping || 0))}`
                        )}
                      </span>
                    </div>
                    {od.productTax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Product Tax</span>
                        <span className="font-medium text-gray-900">{usd((od.productTax ?? 0))}</span>
                      </div>
                    )}
                    {od.productDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Product Discount</span>
                        <span className="font-medium">-{usd((od.productDiscount ?? 0))}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Rental totals */}
                {rentalItems.length > 0 && (
                  <>
                    {productItems.length > 0 && <hr className="border-gray-200 my-2" />}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rentals Subtotal</span>
                      <span className="font-medium text-gray-900">{usd((od.rentalSubtotal || 0))}</span>
                    </div>
                    {od.rentalDeliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rental Delivery</span>
                        <span className="font-medium text-gray-900">
                          {od.freeDelivery ? (
                            <span className="text-emerald-600">Free</span>
                          ) : (
                            `${usd((od.rentalDeliveryFee ?? 0))}`
                          )}
                        </span>
                      </div>
                    )}
                    {od.rentalTax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rental Tax</span>
                        <span className="font-medium text-gray-900">{usd((od.rentalTax ?? 0))}</span>
                      </div>
                    )}
                    {od.rentalDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Rental Discount</span>
                        <span className="font-medium">-{usd((od.rentalDiscount ?? 0))}</span>
                      </div>
                    )}
                    {od.rentalDeposit > 0 && (
                      <div className="flex justify-between text-amber-600">
                        <span>Deposit (refundable)</span>
                        <span className="font-medium">{usd((od.rentalDeposit ?? 0))}</span>
                      </div>
                    )}
                  </>
                )}

                {/* Applied discounts */}
                {od.discounts && od.discounts.length > 0 && od.discounts.some((d: any) => d.amount > 0 || d.type) && (
                  <>
                    <hr className="border-gray-200 my-2" />
                    {od.discounts.map((disc: any, idx: number) => {
                      if (disc.type === 'free_shipping') {
                        return (
                          <div key={idx} className="flex justify-between text-emerald-600 text-xs">
                            <span>Free Shipping Applied</span>
                            <span className="font-medium">✓</span>
                          </div>
                        );
                      }
                      if (disc.amount > 0) {
                        return (
                          <div key={idx} className="flex justify-between text-emerald-600">
                            <span>{disc.code ? `Coupon: ${disc.code}` : disc.name}</span>
                            <span className="font-medium">-{usd((disc.amount ?? 0))}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </>
                )}

                {/* Grand Total */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-xl text-gray-900">{usd((od.amount || 0))}</span>
                  </div>
                  {Number(od.totalRefunded) > 0 && (
                    <>
                      {/* What has come back to the customer, each refund with what it was for (e.g. a return). */}
                      {(Array.isArray(od.refundHistory) ? od.refundHistory : []).map((r: any, i: number) => (
                        <div key={r.ref || r.refundId || i} className="mt-1 flex justify-between text-sm">
                          <span className="text-gray-600">Refunded{r.rmaNumber ? ` (return ${r.rmaNumber})` : ''}{r.refundedAt ? ` · ${new Date(r.refundedAt).toLocaleDateString()}` : ''}</span>
                          <span className="font-medium text-emerald-700">-{usd(Number(r.amount || 0))}</span>
                        </div>
                      ))}
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-gray-600">Total refunded</span>
                        <span className="font-semibold text-emerald-700">{usd(Number(od.totalRefunded))}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            {shipments.some((s: any) => s.trackingUrl) ? (
              <a
                href={shipments.find((s: any) => s.trackingUrl)?.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                Track Order
              </a>
            ) : (
              <a
                // The order's own status page (progress, shipments, tracking numbers). A tracking number the
                // store typed in by hand is not one the carrier lookup on /order/track can find.
                href={`/account/orders/${encodeURIComponent(od.number || '')}`} // Appmint One: the account's order page (receipt + delivery tracking)
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-center"
              >
                Track Order
              </a>
            )}
            {orderCanRequestReturn(selectedOrder) && (
              <button
                type="button"
                onClick={() => {
                  setReturnFor(selectedOrder);
                  setSelectedOrder(null);
                }}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                <IconRenderer icon="RotateCcw" className="w-5 h-5" />
                <span>Request a return</span>
              </button>
            )}
            <a
              href="/account/support" // Appmint One: support lives in the account
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <IconRenderer icon="AlertCircle" className="w-5 h-5" />
              <span>Report Issue</span>
            </a>
          </div>
        </div>
      </SlidePanel>
    );
  };

  return (
    // Appmint One: the order history as a list of rows — status first, the things bought as
    // photos, the total and the two next steps (track, details) on the right.
    <div className="sf-ord">
      <header className="sf-ord-hd">
        <div>
          <h1>Orders</h1>
          <p>{orders.length ? `${orders.length} ${orders.length === 1 ? 'order' : 'orders'} · track one, see its receipt or start a return.` : 'Everything you buy shows up here.'}</p>
        </div>
        {orders.length > 0 && (
          <label className="sf-ord-search">
            <IconRenderer icon="Search" className="w-4 h-4" />
            <input type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search orders or products" aria-label="Search orders" />
          </label>
        )}
      </header>

      {orders.length > 0 && (() => {
        // Only the statuses these orders are in — not all fifteen the schema allows.
        const present = ORDER_STATUSES.filter((s) => orders.some((o: any) => ((o.data || o)?.status || 'new') === s.value));
        return present.length > 0 ? (
          <nav className="sf-ord-tabs" aria-label="Filter by status">
            {[{ value: 'all', label: 'All' }, ...present].map((s) => (
              <button key={s.value} type="button" className={filterStatus === s.value ? 'on' : ''} aria-pressed={filterStatus === s.value} onClick={() => setFilterStatus(s.value)}>
                {s.label}
                <span>{s.value === 'all' ? orders.length : orders.filter((o: any) => ((o.data || o)?.status || 'new') === s.value).length}</span>
              </button>
            ))}
          </nav>
        ) : null;
      })()}

      {filteredOrders?.length > 0 ? (
        <ul className="sf-ord-list">
          {filteredOrders.map((order: any, orderIdx: number) => {
            const orderData = order.data || order;
            const orderNumber = orderData.number || 'N/A';
            const orderDate = order.createdate || orderData.createdate || '';
            const allItems = getAllItems(orderData);
            const orderTotal = orderData.amount || 0;
            const orderStatus = orderData.status || 'new';
            const orderType = orderData.orderType;
            const itemCount = (orderData.productCount || 0) + (orderData.rentalCount || 0) || allItems.length;
            const names = allItems.map((i: any) => i?.name).filter(Boolean);

            return (
              <li key={order.sk || order._id || orderIdx} className="sf-ord-row">
                <button type="button" className="sf-ord-hit" onClick={() => setSelectedOrder(order)} aria-label={`Order ${orderNumber} details`} />
                <div className="sf-ord-pics" aria-hidden="true">
                  {allItems.slice(0, 3).map((item: any, idx: number) => (
                    <span key={item.sku || idx}>{item.image ? <img src={item.image} alt="" loading="lazy" /> : null}</span>
                  ))}
                  {allItems.length > 3 && <span className="more">+{allItems.length - 3}</span>}
                </div>
                <div className="sf-ord-copy">
                  <p className={`sf-ord-status ${statusTone(orderStatus)}`}><i aria-hidden="true" />{getStatusLabel(orderStatus)}{orderDate && <small>Placed {formatDate(orderDate)}</small>}</p>
                  <h3>{names.slice(0, 2).join(', ') || `Order ${orderNumber}`}{names.length > 2 && <span> and {names.length - 2} more</span>}</h3>
                  <p className="sf-ord-meta">
                    Order #{orderNumber} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    {orderType && orderType !== 'product' && <> · <span className="cap">{orderType}</span></>}
                  </p>
                </div>
                <div className="sf-ord-side">
                  <strong>{usd(orderTotal)}</strong>
                  <div className="sf-ord-acts">
                    <a href={`/account/orders/${encodeURIComponent(orderNumber)}`} className="sf-btn sm">Track order</a>
                    <button type="button" className="sf-btn sm ghost" onClick={() => setSelectedOrder(order)}>Details</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="sf-ord-empty">
          <span className="ic"><IconRenderer icon="ShoppingBag" className="w-7 h-7" /></span>
          <h3>{searchQuery || filterStatus !== 'all' ? 'No orders match' : 'No orders yet'}</h3>
          <p>{searchQuery || filterStatus !== 'all' ? 'Try another search or status.' : "When you buy something, you'll track it here."}</p>
          {searchQuery || filterStatus !== 'all' ? (
            <button type="button" className="sf-btn ghost" onClick={() => { setSearchQuery(''); setFilterStatus('all'); }}>Show all orders</button>
          ) : (
            <a href="/" className="sf-btn">Start shopping</a>
          )}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && <OrderDetails />}

      {/* Request a return (F-SF-RET-014) */}
      <SlidePanel
        isOpen={!!returnFor}
        onClose={() => setReturnFor(null)}
        title={`Return items from order ${(returnFor?.data || returnFor)?.number || ''}`}
        width="560px"
      >
        {returnFor && <ReturnRequestForm order={returnFor} onDone={() => setReturnFor(null)} />}
      </SlidePanel>
    </div>
  );
};
