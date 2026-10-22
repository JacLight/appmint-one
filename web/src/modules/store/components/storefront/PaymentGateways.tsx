// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
'use client';

// from base-app/src/components/storefront/PaymentGateways.tsx — ported verbatim; only import paths rewired.
import React, { useMemo, useCallback } from 'react';
import { PayPalPayment } from '@/modules/store/components/payment-gateways/paypal';
import { GiftCardPayment } from '@/modules/store/components/payment-gateways/gift-card';
import { OfflinePayment } from '@/modules/store/components/payment-gateways/offline';
import { PaymentAmount, CustomerInfo, PaymentResult } from '@/modules/store/components/payment-gateways/types';
import { IconRenderer } from '@/modules/store/components/ui/icon-renderer';
import { StripePayment } from '../payment-gateways/stripe';
import PayOxygenPayment from '../payment-gateways/payoxygen/payoxygen-payment';

interface PaymentGateway {
  name: string;
  displayName?: string;
  description?: string;
}

interface PaymentGatewaysProps {
  paymentGateways: PaymentGateway[];
  editingSection: 'contact' | 'shipping' | 'rental' | 'payment' | null;
  completedSections: Set<string>;
  completeSection: (section: string) => void;
  editSection: (section: 'contact' | 'shipping' | 'rental' | 'payment') => void;
  amount: PaymentAmount;
  customer: CustomerInfo;
  onPaymentSuccess: (result: PaymentResult) => void;
  onPaymentError: (error: string) => void;
  /** Shown at the top of the payment step — the cart's gift cards. */
  lead?: React.ReactNode;
  /** Shown instead of the gateways when nothing is left to charge. */
  settled?: React.ReactNode;
  /** Providers this page handles itself and should not list (the cart applies gift cards above). */
  excludeProviders?: string[];
}

// Map of all payment gateway components - moved outside component to prevent recreation.
// No account-balance gateway: store credit and reward points are the customer wallet, applied in the checkout
// before the gateways (its old component kept balances nowhere real and could only fail).
const paymentGatewayComponents = {
  StripeProvider: StripePayment,
  PayOxygenProvider: PayOxygenPayment,
  PayPalProvider: PayPalPayment,
  GiftCardProvider: GiftCardPayment,
  OfflineProvider: OfflinePayment,
};

export const PaymentGateways: React.FC<PaymentGatewaysProps> = ({
  paymentGateways,
  editingSection,
  completedSections,
  completeSection,
  editSection,
  amount,
  customer,
  onPaymentSuccess,
  onPaymentError,
  lead,
  settled,
  excludeProviders,
}) => {
  // Memoize the payment success handler to prevent unnecessary re-renders
  const handlePaymentSuccess = useCallback(
    (result: PaymentResult) => {
      completeSection('payment');
      onPaymentSuccess(result);
    },
    [completeSection, onPaymentSuccess],
  );

  // Memoize common props to prevent unnecessary re-renders
  const commonProps = useMemo(
    () => ({
      amount,
      customer,
      onSuccess: handlePaymentSuccess,
      onError: onPaymentError,
      disabled: false,
      metadata: {},
    }),
    [amount, customer, handlePaymentSuccess, onPaymentError],
  );


  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between p-8 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              completedSections.has('payment') ? 'bg-emerald-500' : editingSection === 'payment' ? 'bg-slate-900' : 'bg-slate-300'
            }`}
          >
            {completedSections.has('payment') ? (
              <IconRenderer icon="Check" className="w-4 h-4 text-white" />
            ) : (
              <span className="text-sm font-semibold text-white">3</span>
            )}
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Payment Method</h3>
        </div>
        {completedSections.has('payment') && (
          <button onClick={() => editSection('payment')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
            <IconRenderer icon="Edit3" className="w-4 h-4" />
            <span className="text-sm font-medium">Edit</span>
          </button>
        )}
      </div>

      {editingSection === 'payment' || !completedSections.has('payment') ? (
        <div className="p-8 space-y-6">
          {lead}
          {settled}
          {!settled && paymentGateways.length === 0 && (
            <p role="status" className="text-sm text-slate-700">
              Online payment is not available for this store yet. Please contact the store before placing an order.
            </p>
          )}
          {!settled && paymentGateways.filter((gateway: any) => !excludeProviders?.includes(gateway?.data?.provider)).map((gateway: any) => {
            const PaymentComponent = paymentGatewayComponents[gateway?.data?.provider];

            // The store can't take cards right now (its Stripe agreement): the shopper is told only
            // that, and pays another way the store offers. The reason goes to the store owner.
            if (gateway?.unavailable) {
              return (
                <div key={gateway.name || gateway.data?.provider} role="status" className="border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-600">{gateway.message || 'Card payment is unavailable right now'}</p>
                </div>
              );
            }

            if (!PaymentComponent) {
              return (
                <div key={gateway.name} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-gray-600">Payment gateway "{gateway.name}" not available</p>
                </div>
              );
            }

            return (
              <div key={gateway.name} className="border border-gray-200 rounded-lg p-4">
                <PaymentComponent {...commonProps} gateway={gateway} {...(gateway.data.provider === 'OfflineProvider' ? { allowPayLater: true } : {})} />
              </div>
            );
          })}
        </div>
      ) : completedSections.has('payment') ? (
        <div className="p-8 bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <IconRenderer icon="Check" className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-slate-700 font-medium">Payment Completed</p>
              <p className="text-slate-600 text-sm">Your payment has been processed successfully</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
