'use client';

// from base-app/src/components/storefront/CheckoutCart.tsx — ported verbatim; only import paths rewired.
import React from 'react';
import { showRentalDate, rentalUnit } from '@/modules/store/components/rental/dates';
import { Input } from '@/modules/store/components/ui/input';
import { Button } from '@/modules/store/components/ui/button';
import { Loader2, X, Tag, Truck, Gift, Crown, ShoppingBag, ChevronDown, Calendar } from 'lucide-react';
import { ShippingOption, AppliedPromotion, CustomerBenefits } from '@/modules/store/store/cart-store';
import { LineItemOptions } from './LineItemOptions';
import { AttributeTitle, AttributeValue } from './AttributeLabel';
import type { LineItemDesign, LineItemOption } from './utils/custom-attributes';
import { PayWithPoints, type PointsPricedLine } from './store-credit/PayWithPoints';

const fmt = (v: any) => (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); // Appmint One: thousands separators

// Cart items from server - flexible to accept any fields
interface CartItem extends PointsPricedLine {
  id: string;
  cartItemId?: string;
  sku?: string;
  name: string;
  image: string;
  quantity: number;
  unitPrice?: number;
  finalPrice?: number;
  originalPrice?: number;
  amount?: number; // server-calculated line total
  /** Server-calculated pre-discount line total, for the struck-through price. */
  originalTotal?: number;
  /** Server-calculated tier discount for the whole line. */
  tierDiscountTotal?: number;
  totalPrice?: number; // same as amount (server-calculated total for this line)
  lineTotal?: number; // amount + fees (server-calculated)
  discount?: number;
  tierDiscount?: number; // per-unit tier discount
  discountPercent?: number; // discount percentage
  deposit?: number; // rentals only
  categoryId?: string;
  itemType?: 'product' | 'rental' | 'fee' | 'addon';
  parentSku?: string;
  waived?: boolean;
  appliedRule?: string;
  appliedRuleType?: string;
  // Rental-specific
  startDate?: string;
  endDate?: string;
  rentalPeriod?: string;
  duration?: number;
  fees?: Array<{ name: string; amount: number; type?: string }>;
  // Chosen attribute values - uploaded artwork rides in options[].files
  options?: LineItemOption[];
  design?: LineItemDesign;
  // Legacy/UI fields
  attributes?: Record<string, any>;
  price?: number;
}

interface CheckoutCartProps {
  // Separate arrays per SDK sf-cart schema
  productItems: CartItem[];
  rentalItems: CartItem[];
  // Combined totals from server (matches SDK sf-cart schema)
  subtotal: number;
  tax: number;
  discount: number;
  total: number; // Grand total (includes deposit)
  // Rental breakdown
  rentalSubtotal?: number;
  rentalDeposit?: number;
  rentalTax?: number;
  rentalDeliveryFee?: number;
  rentalTotal?: number;
  // Product breakdown
  productSubtotal?: number;
  productTax?: number;
  productShipping?: number;
  productTotal?: number;
  // Coupon
  couponCode: string;
  setCouponCode: React.Dispatch<React.SetStateAction<string>>;
  applyCoupon: () => Promise<void>;
  // Enhanced props
  shippingOptions?: ShippingOption[];
  selectedShipping?: ShippingOption | null;
  onSelectShipping?: (option: ShippingOption) => void;
  shippingLoading?: boolean;
  quoteUnavailable?: string;
  /** The shop doesn't ship an item to this address (a shop rule): shipping reads "Not available", prices stay. */
  shippingBlocked?: string;
  appliedPromotions?: AppliedPromotion[];
  onRemovePromotion?: (name: string) => void;
  couponError?: string | null;
  couponLoading?: boolean;
  customerBenefits?: CustomerBenefits | null;
  // Mobile collapsible products (uses native details/summary)
  mobileCollapsibleProducts?: boolean;
  /** Reward points on product lines — only for a signed-in shopper (the toggle is hidden without `onPayWithPoints`). */
  pointsBalance?: number;
  /** The server's word on the points lines together ("You need 1,200 points — you have 800"). */
  pointsProblem?: string;
  pointsBusy?: boolean;
  /** The shopper's own choice on the cart line this priced line is for. */
  isPayingWithPoints?: (line: CartItem) => boolean;
  onPayWithPoints?: (line: CartItem, payWithPoints: boolean) => void;
}

export const CheckoutCart: React.FC<CheckoutCartProps> = ({
  productItems = [],
  rentalItems = [],
  subtotal,
  tax,
  discount,
  total,
  // Rental breakdown
  rentalSubtotal = 0,
  rentalDeposit = 0,
  rentalTax = 0,
  rentalDeliveryFee = 0,
  rentalTotal = 0,
  // Product breakdown
  productSubtotal = 0,
  productTax = 0,
  productShipping = 0,
  productTotal = 0,
  couponCode,
  setCouponCode,
  applyCoupon,
  shippingOptions = [],
  selectedShipping,
  onSelectShipping,
  shippingLoading,
  quoteUnavailable,
  shippingBlocked,
  appliedPromotions = [],
  onRemovePromotion,
  couponError,
  couponLoading,
  customerBenefits,
  mobileCollapsibleProducts = false,
  pointsBalance,
  pointsProblem,
  pointsBusy,
  isPayingWithPoints,
  onPayWithPoints,
}) => {
  // A line paid with reward points: the server prices its money at 0 and says how many points it takes.
  const paidWithPoints = (item: CartItem) => !!item.payWithPoints && item.rewardPointsTotal !== undefined && item.rewardPointsTotal !== null;
  const lineMoney = (item: CartItem, lineTotal: number) =>
    paidWithPoints(item) ? `${new Intl.NumberFormat('en-US').format(Number(item.rewardPointsTotal) || 0)} points` : `$${fmt(lineTotal)}`;
  const pointsToggle = (item: CartItem) =>
    onPayWithPoints ? (
      <PayWithPoints
        line={item}
        chosen={isPayingWithPoints ? isPayingWithPoints(item) : !!item.payWithPoints}
        balance={pointsBalance}
        busy={pointsBusy}
        onChange={(on) => onPayWithPoints(item, on)}
      />
    ) : item.pointsProblem ? (
      <p className="mt-1 text-xs text-amber-700">{item.pointsProblem}</p>
    ) : null;
  // Promotions that give points or store credit: a line of their own, never money off.
  const rewardGifts = appliedPromotions.filter((p) => (p.type === 'reward_points' || p.type === 'store_credit') && p.note);

  // Helper to format date range for rentals
  const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return null;
    return `${showRentalDate(startDate)} - ${showRentalDate(endDate)}`;
  };

  const itemCount = productItems.reduce((sum, item) => sum + item.quantity, 0) + rentalItems.reduce((sum, item) => sum + item.quantity, 0);

  const hasProducts = productItems.length > 0;
  const hasRentals = rentalItems.length > 0;

  return (
    <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto overflow-hidden bg-white rounded-2xl border border-slate-200 h-fit">{/* a summary taller than the window scrolls inside itself: its totals were out of reach on laptop screens */}
      <div className="p-8 border-b border-slate-100">
        <h3 className="text-2xl font-semibold text-slate-900">Order Summary</h3>
      </div>
      <div className="p-8">
        {/* Customer Benefits Badge */}
        {customerBenefits && customerBenefits.tierName && (
          <div className="mb-6 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-600" />
              <span className="font-semibold text-amber-800">{customerBenefits.tierName} Member</span>
            </div>
            <div className="mt-2 text-sm text-amber-700 space-y-1">
              {customerBenefits.discountPercent > 0 && <p>• {customerBenefits.discountPercent}% member discount applied</p>}
              {customerBenefits.freeShipping && <p>• Free shipping on all orders</p>}
              {customerBenefits.freeShippingMinimum && !customerBenefits.freeShipping && (
                <p>• Free shipping over ${customerBenefits.freeShippingMinimum}</p>
              )}
            </div>
          </div>
        )}

        {/* Items - Collapsible on mobile using native details/summary */}
        {mobileCollapsibleProducts ? (
          <details className="mb-6 group">
            <summary className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 text-slate-600" />
                  <span className="absolute -top-2 -right-2 bg-slate-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium">
                    {itemCount}
                  </span>
                </div>
                <span className="font-medium text-slate-700">
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span> items ({itemCount})
                </span>
                <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
              </div>
              <span className="font-semibold text-slate-900">${fmt(subtotal)}</span>
            </summary>
            <div className="mt-4 space-y-6">
              {/* Products */}
              {productItems.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" /> Products
                  </h5>
                  <div className="space-y-3">
                    {productItems.map((item, index) => (
                      <div key={(item as any).cartItemId || `${item.id}-${item.sku}-${index}`} className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                          <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded" />
                          <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                            {item.quantity}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm leading-tight">{item.name}</p>
                          {item.attributes && Object.keys(item.attributes).length > 0 && (
                            <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                              {Object.entries(item.attributes)
                                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                                .map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium"><AttributeTitle name={key} />:</span> <AttributeValue name={key} value={value} />
                                  </div>
                                ))}
                            </div>
                          )}
                          {/* Uploaded artwork / instructions and the design proof */}
                          <LineItemOptions options={item.options?.filter((option) => option.type || !item.attributes || !(option.name in item.attributes))} design={item.design} className="mt-1" compact />
                          {pointsToggle(item)}
                          {/* Show unit price with discount info */}
                          {(() => {
                            const unitPrice = item.unitPrice ?? item.finalPrice ?? 0;
                            const originalPrice = item.originalPrice ?? unitPrice;
                            const hasDiscount = originalPrice > unitPrice;

                            return (
                              <div className="mt-1">
                                {hasDiscount ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-emerald-600 font-medium text-sm">${fmt(unitPrice)}/ea</span>
                                    <span className="text-slate-400 line-through text-xs">${fmt(originalPrice)}</span>
                                  </div>
                                ) : (
                                  <p className="text-slate-600 text-sm">${fmt(unitPrice)}/ea</p>
                                )}
                                {item.appliedRule && (
                                  <p className="text-xs text-emerald-600 mt-0.5">{item.appliedRule}</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {/* Show line total with savings */}
                        {(() => {
                          // Server figures only. `unitPrice * quantity` here looks
                          // right and disagrees with the invoice the moment a price
                          // rule, price list or tier resolves differently server-side.
                          const lineTotal = item.amount ?? item.totalPrice ?? 0;
                          const originalTotal = item.originalTotal ?? 0;
                          const savings = originalTotal - lineTotal;
                          const hasSavings = !paidWithPoints(item) && savings > 0.01;

                          return (
                            <div className="text-right">
                              <p className={`font-bold ${hasSavings ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {quoteUnavailable ? '—' : lineMoney(item, lineTotal)}
                              </p>
                              {hasSavings && (
                                <p className="text-xs text-emerald-600">Save ${fmt(savings)}</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Rentals */}
              {rentalItems.length > 0 && (
                <div>
                  <h5 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Rentals
                  </h5>
                  <div className="space-y-3">
                    {rentalItems.map((item, index) => {
                      const fees = item.fees || [];
                      const deposit = item.deposit ?? 0;
                      const amount = item.amount ?? item.unitPrice ?? 0;
                      const lineTotal = (item as any).lineTotal;
                      const unitPrice = item.unitPrice ?? 0;

                      return (
                        <div key={(item as any).cartItemId || `${item.id}-${item.sku}-${index}`} className="border border-slate-100 rounded-lg p-3">
                          <div className="flex items-start gap-3">
                            <div className="relative flex-shrink-0">
                              <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded" />
                              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                                {item.quantity}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 text-sm leading-tight">{item.name}</p>
                              {item.startDate && item.endDate && (
                                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDateRange(item.startDate, item.endDate)}
                                </p>
                              )}
                              {unitPrice && item.rentalPeriod && item.duration && (
                                <p className="text-xs text-slate-500 mt-1">
                                  ${fmt(unitPrice)}/{rentalUnit(item.rentalPeriod)} × {item.duration}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 text-xs">
                            <div className="flex justify-between text-slate-600">
                              <span>Subtotal</span>
                              <span>${fmt(amount)}</span>
                            </div>
                            {fees.map((fee: any, feeIdx: number) => (
                              <div key={feeIdx} className="flex justify-between text-slate-600">
                                <span>{fee.name}</span>
                                <span>${fmt(fee.amount || 0)}</span>
                              </div>
                            ))}
                            {lineTotal && fees.length > 0 && (
                              <div className="flex justify-between font-semibold text-slate-900 pt-1">
                                <span>Line Total</span>
                                <span>{quoteUnavailable ? '—' : `$${fmt(lineTotal)}`} </span>
                              </div>
                            )}
                            {deposit > 0 && (
                              <div className="flex justify-between text-amber-600">
                                <span>Deposit</span>
                                <span>${fmt(deposit)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </details>
        ) : (
          <div className="space-y-6 mb-8">
            {/* Products Section */}
            {productItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Products ({productItems.length})
                </h4>
                <div className="space-y-4">
                  {productItems.map((item, index) => (
                    <div key={(item as any).cartItemId || `${item.id}-${item.sku}-${index}`} className="flex items-start gap-3">
                      <div className="relative flex-shrink-0">
                        <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded" />
                        <span className="absolute -top-1 -right-1 bg-slate-900 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm leading-tight">{item.name}</p>
                        {item.attributes && Object.keys(item.attributes).length > 0 && (
                          <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                            {Object.entries(item.attributes)
                              .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
                              .map(([key, value]) => (
                                <div key={key}>
                                  <span className="font-medium"><AttributeTitle name={key} />:</span> <AttributeValue name={key} value={value} />
                                </div>
                              ))}
                          </div>
                        )}
                        {/* Uploaded artwork / instructions and the design proof */}
                        <LineItemOptions options={item.options?.filter((option) => option.type || !item.attributes || !(option.name in item.attributes))} design={item.design} className="mt-1" compact />
                        {pointsToggle(item)}
                        {/* Show pricing with discount info */}
                        {(() => {
                          const unitPrice = item.unitPrice ?? item.finalPrice ?? 0;
                          const originalPrice = item.originalPrice ?? unitPrice;
                          const hasDiscount = originalPrice > unitPrice;

                          if (hasDiscount || item.appliedRule) {
                            return (
                              <div className="mt-1 space-y-1">
                                {item.appliedRule && (
                                  <span className="inline-block text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                                    {item.appliedRule}
                                    {item.discountPercent ? ` (-${Math.round(Number(item.discountPercent) || 0)}%)` : ''}
                                  </span>
                                )}
                                <div className="flex items-center gap-2">
                                  {hasDiscount && (
                                    <span className="text-slate-400 line-through text-xs">${fmt(originalPrice)}</span>
                                  )}
                                  <span className={`text-sm font-medium ${hasDiscount ? 'text-emerald-600' : 'text-slate-600'}`}>
                                    ${fmt(unitPrice)}/ea
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return <p className="text-slate-600 text-sm mt-1">${fmt(unitPrice)}/ea</p>;
                        })()}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {(() => {
                          // Server figures only. `unitPrice * quantity` here looks
                          // right and disagrees with the invoice the moment a price
                          // rule, price list or tier resolves differently server-side.
                          const lineTotal = item.amount ?? item.totalPrice ?? 0;
                          const originalTotal = item.originalTotal ?? 0;
                          const savings = originalTotal - lineTotal;
                          const hasSavings = !paidWithPoints(item) && savings > 0.01;

                          return (
                            <div>
                              <p className={`font-bold ${hasSavings ? 'text-emerald-600' : 'text-slate-900'}`}>
                                {quoteUnavailable ? '—' : lineMoney(item, lineTotal)}
                              </p>
                              {hasSavings && (
                                <p className="text-xs text-emerald-600">
                                  Save ${fmt(savings)}
                                  {item.tierDiscount && item.tierDiscount > 0 && ` fmt(${item.tierDiscountTotal ?? 0} tier)`}
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rentals Section */}
            {rentalItems.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Rentals ({rentalItems.length})
                </h4>
                <div className="space-y-4">
                  {rentalItems.map((item, index) => {
                    // Display only what server sends
                    const fees = item.fees || [];
                    const deposit = item.deposit ?? 0;
                    const amount = item.amount ?? item.unitPrice ?? 0;
                    const lineTotal = (item as any).lineTotal; // amount + fees
                    const unitPrice = item.unitPrice ?? 0;

                    return (
                      <div key={(item as any).cartItemId || `${item.id}-${item.sku}-${index}`} className="border border-slate-100 rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="relative flex-shrink-0">
                            <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded" />
                            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                              {item.quantity}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm leading-tight">{item.name}</p>
                            {item.startDate && item.endDate && (
                              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateRange(item.startDate, item.endDate)}
                              </p>
                            )}
                            {unitPrice && item.rentalPeriod && item.duration && (
                              <p className="text-xs text-slate-500 mt-1">
                                ${fmt(unitPrice)}/{rentalUnit(item.rentalPeriod)} × {item.duration}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Display server data only - no calculations */}
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Subtotal</span>
                            <span>${fmt(amount)}</span>
                          </div>
                          {fees.map((fee: any, feeIdx: number) => (
                            <div key={feeIdx} className="flex justify-between text-slate-600">
                              <span>{fee.name}</span>
                              <span>${fmt(fee.amount || 0)}</span>
                            </div>
                          ))}
                          {lineTotal && fees.length > 0 && (
                            <div className="flex justify-between font-semibold text-slate-900 pt-1 border-t border-slate-100">
                              <span>Line Total</span>
                              <span>{quoteUnavailable ? '—' : `$${fmt(lineTotal)}`} </span>
                            </div>
                          )}
                          {deposit > 0 && (
                            <div className="flex justify-between text-amber-600">
                              <span>Deposit (refundable)</span>
                              <span>${fmt(deposit)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shipping Options */}
        {shippingOptions.length > 0 && onSelectShipping && (
          <div className="border-t border-slate-100 pt-6 mb-6">
            <h4 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Shipping Method
            </h4>
            {shippingLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">Calculating rates...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {shippingOptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedShipping?.id === option.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="shipping"
                        checked={selectedShipping?.id === option.id}
                        onChange={() => onSelectShipping(option)}
                        className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-slate-900"
                      />
                      <div>
                        <p className="font-medium text-sm text-slate-900">{option.name}</p>
                        {option.deliveryDays && (
                          <p className="text-xs text-slate-500">
                            {option.deliveryDays === 1 ? 'Next day' : `${option.deliveryDays} days`}
                            {option.deliveryDate && ` (Est. ${new Date(option.deliveryDate).toLocaleDateString()})`}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-sm">{option.customerPrice === 0 ? 'Free' : `$${fmt(option.customerPrice)}`}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Applied Promotions */}
        {appliedPromotions.length > 0 && (
          <div className="border-t border-slate-100 pt-6 mb-6">
            <h4 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Gift className="w-4 h-4" />
              Applied Discounts
            </h4>
            <div className="space-y-2">
              {appliedPromotions.map((promo) => (
                <div key={promo.name} className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-sm font-medium text-emerald-800">{promo.name}</p>
                      {promo.code && <p className="text-xs text-emerald-600">Code: {promo.code}</p>}
                      {promo.note && <p className="text-xs text-emerald-700">{promo.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {promo.appliedAmount > 0 && <span className="text-sm font-semibold text-emerald-700">-${fmt(promo.appliedAmount)}</span>}
                    {!promo.autoApplied && onRemovePromotion && (
                      <button onClick={() => onRemovePromotion(promo.name)} className="p-1 hover:bg-emerald-100 rounded">
                        <X className="w-4 h-4 text-emerald-600" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Coupon */}
        <div className="border-t border-slate-100 pt-6 mb-6">
          <h4 className="text-base font-semibold text-slate-900 mb-3">Promo Code</h4>
          <div className="space-y-3">
            <Input
              placeholder="Enter discount code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className={`w-full h-10 text-sm border-slate-300 focus:border-slate-900 focus:ring-slate-900 ${couponError ? 'border-red-300' : ''}`}
            />
            {couponError && <p className="text-sm text-red-600">{couponError}</p>}
            <Button
              onClick={applyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              variant="default"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white h-10 font-medium text-sm disabled:opacity-50"
            >
              {couponLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Applying...
                </>
              ) : (
                'Apply Coupon'
              )}
            </Button>
          </div>
        </div>

        {/* Totals - Split by Product and Rental */}
        <div className="border-t border-slate-100 pt-6 space-y-4">
          {pointsProblem && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {pointsProblem}
            </p>
          )}
          {(() => {
            // Check for waived items based on discount types
            const hasFreeShipping = appliedPromotions.some((p) => p.type === 'free_shipping');
            const hasFreeDeposit = appliedPromotions.some((p) => p.type === 'free_deposit');
            const hasFreeDelivery = appliedPromotions.some((p) => p.type === 'free_delivery');
            const hasWaiveFees = appliedPromotions.some((p) => p.type === 'waive_fees');

            return (
              <>
                {/* Products Section */}
                {hasProducts && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                      <ShoppingBag className="w-3 h-3" /> Products
                    </div>
                    <div className="flex justify-between text-slate-700 text-sm">
                      <span>Subtotal</span>
                      <span className="font-medium">{quoteUnavailable ? '—' : `$${fmt(productSubtotal)}`}</span>
                    </div>
                    {/* Discounts come off before the product total they are part of (shop-only carts). */}
                    {!hasRentals &&
                      !quoteUnavailable &&
                      appliedPromotions
                        .filter((p) => p.appliedAmount > 0)
                        .map((promo, idx) => (
                          <div key={`pd-${idx}`} className="flex justify-between text-emerald-600 text-sm">
                            <span className="font-medium">{promo.name}</span>
                            <span className="font-semibold">-${fmt(promo.appliedAmount)}</span>
                          </div>
                        ))}
                    <div className={`flex justify-between text-sm ${hasFreeShipping ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                      <span>Shipping</span>
                      <span className="font-medium">
                        {shippingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : quoteUnavailable ? (quoteUnavailable === 'Awaiting current quote' ? 'Pending' : 'Unavailable') : shippingBlocked ? 'Not available' : `$${fmt(productShipping)}`}
                      </span>
                    </div>
                    {productTax > 0 && (
                      <div className="flex justify-between text-slate-700 text-sm">
                        <span>Tax</span>
                        <span className="font-medium">${fmt(productTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-semibold text-sm pt-1 border-t border-slate-100">
                      <span>Product Total</span>
                      <span>{quoteUnavailable ? '—' : `$${fmt(productTotal)}`}</span>
                    </div>
                  </div>
                )}

                {/* Rentals Section */}
                {hasRentals && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Rentals
                    </div>
                    <div className="flex justify-between text-slate-700 text-sm">
                      <span>Subtotal</span>
                      <span className="font-medium">${fmt(rentalSubtotal)}</span>
                    </div>
                    {rentalDeliveryFee > 0 && (
                      <div className={`flex justify-between text-sm ${hasFreeDelivery ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                        <span>Delivery</span>
                        <span className="font-medium">${fmt(rentalDeliveryFee)}</span>
                      </div>
                    )}
                    {rentalTax > 0 && (
                      <div className="flex justify-between text-slate-700 text-sm">
                        <span>Tax</span>
                        <span className="font-medium">${fmt(rentalTax)}</span>
                      </div>
                    )}
                    {rentalDeposit > 0 && (
                      <div className={`flex justify-between text-sm ${hasFreeDeposit ? 'text-slate-400 line-through' : 'text-amber-600'}`}>
                        <span>Deposit (refundable)</span>
                        <span className="font-medium">${fmt(rentalDeposit)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 font-semibold text-sm pt-1 border-t border-slate-100">
                      <span>Rental Total</span>
                      <span>${fmt(rentalTotal)}</span>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Applied Discounts (carts with rentals: they span both sections) */}
          {hasRentals && appliedPromotions.length > 0 && appliedPromotions.some((p) => p.appliedAmount > 0) && (
            <div className="space-y-1">
              {appliedPromotions
                .filter((p) => p.appliedAmount > 0)
                .map((promo, idx) => (
                  <div key={idx} className="flex justify-between text-emerald-600 text-sm">
                    <span className="font-medium">{promo.name}</span>
                    <span className="font-semibold">-${fmt(promo.appliedAmount)}</span>
                  </div>
                ))}
            </div>
          )}

          {/* Promotions that give points or store credit with this order: the server's sentence, not money off */}
          {!quoteUnavailable && rewardGifts.length > 0 && (
            <div className="space-y-1">
              {rewardGifts.map((promo, idx) => (
                <div key={`rg-${idx}`} className="flex items-center gap-2 text-emerald-700 text-sm">
                  <Gift className="w-4 h-4 shrink-0" />
                  <span>
                    <span className="font-medium">{promo.note}</span>
                    {promo.name && <span className="text-emerald-600"> · {promo.name}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Grand Total */}
          <div className="flex justify-between font-bold text-xl border-t border-slate-200 pt-4 text-slate-900">
            <span>Total</span>
            <span>{quoteUnavailable ? '—' : `$${fmt(total)}`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
