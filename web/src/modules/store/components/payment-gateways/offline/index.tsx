'use client';

// from base-app/src/components/payment-gateways/offline/index.tsx — ported verbatim; only import paths rewired.
import React, { useState } from 'react';
import { PaymentComponentProps } from '../types';

interface OfflinePaymentProps extends PaymentComponentProps {
  allowPayLater?: boolean;
  supportedMethods?: ('bank_transfer' | 'cash' | 'check' | 'wire_transfer')[];
  bankDetails?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber?: string;
    swiftCode?: string;
  };
  instructions?: string;
}

export const OfflinePayment: React.FC<OfflinePaymentProps> = ({
  amount,
  allowPayLater = false,
  customer,
  supportedMethods = ['bank_transfer', 'cash'],
  bankDetails,
  instructions,
  onSuccess,
  onError,
  onCancel,
  disabled,
  showTitle,
  className,
  metadata,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<string>(supportedMethods[0]);
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const methodLabels = {
    bank_transfer: 'Bank Transfer',
    cash: 'Cash Payment',
    check: 'Check Payment',
    wire_transfer: 'Wire Transfer',
  };

  const generateReference = () => {
    return `OFF-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (processing || disabled || !confirmed || !allowPayLater) return;

    setProcessing(true);

    try {
      // This selects payment on collection; no money has changed hands.
      // Checkout persists the order without a paid transaction.
      const reference = generateReference();

      onSuccess({
        success: true,
        payment_intent_id: reference,
        transaction_id: reference,
        metadata: {
          gateway: 'offline',
          method: selectedMethod,
          reference,
          status: 'pending_payment',
        },
      });
    } catch (error: any) {
      onError(error.message || 'Failed to create payment request');
    } finally {
      setProcessing(false);
    }
  };

  const renderBankDetails = () => {
    if (!bankDetails) return null;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-blue-900 mb-3">Bank Transfer Details</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">Bank Name:</span>
            <span>{bankDetails.bankName}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Account Name:</span>
            <span>{bankDetails.accountName}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Account Number:</span>
            <span className="font-mono">{bankDetails.accountNumber}</span>
          </div>
          {bankDetails.routingNumber && (
            <div className="flex justify-between">
              <span className="font-medium">Routing Number:</span>
              <span className="font-mono">{bankDetails.routingNumber}</span>
            </div>
          )}
          {bankDetails.swiftCode && (
            <div className="flex justify-between">
              <span className="font-medium">SWIFT Code:</span>
              <span className="font-mono">{bankDetails.swiftCode}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderInstructions = () => {
    const defaultInstructions = {
      // "provided above" only when the bank details are actually shown above (returns course, 11 Oct)
      bank_transfer: bankDetails
        ? 'Please transfer the exact amount to the bank account details provided above. Include your reference number in the transfer description for faster processing.'
        : "Please transfer the exact amount to the business's bank account, with your order number in the transfer description. The business confirms the payment when it arrives.",
      cash: 'Please visit our office during business hours to make a cash payment. Bring this reference number for quick processing.',
      check: 'Please mail a check for the exact amount to our office address. Write the reference number on the memo line.',
      wire_transfer:
        'Please initiate a wire transfer for the exact amount using the bank details provided. Include the reference number in the transfer details.',
    };

    const instruction = instructions || defaultInstructions[selectedMethod as keyof typeof defaultInstructions];

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <h4 className="font-semibold text-gray-900 mb-2">Payment Instructions</h4>
        <p className="text-sm text-gray-700">{instruction}</p>
      </div>
    );
  };

  return (
    <div className={className}>
      {showTitle && (
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Offline Payment</h3>
          <p className="text-sm text-gray-600">Pay via bank transfer, cash, or other offline methods</p>
        </div>
      )}

      {!allowPayLater && <p role="status" className="mb-4 text-sm text-slate-700">Please contact the business to arrange payment. The business will confirm it after receiving the funds.</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Payment Method Selection */}
        {supportedMethods.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="space-y-2">
              {supportedMethods.map((method) => (
                <label key={method} className="flex items-center">
                  <input
                    type="radio"
                    value={method}
                    checked={selectedMethod === method}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{methodLabels[method as keyof typeof methodLabels]}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Payment Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Payment Amount:</span>
            <span className="text-lg font-semibold">
              {amount.currency} {(amount.amount ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Payment Method:</span>
            <span className="text-sm">{methodLabels[selectedMethod as keyof typeof methodLabels]}</span>
          </div>
        </div>

        {/* Bank Details (for bank transfer) */}
        {(selectedMethod === 'bank_transfer' || selectedMethod === 'wire_transfer') && renderBankDetails()}

        {/* Instructions */}
        {renderInstructions()}

        {/* Important Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Important Notice</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Your order will be processed once we receive your payment. Please keep your reference number safe as you'll need it for any
                  inquiries.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation */}
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">
              I understand that I need to complete the payment using the {methodLabels[selectedMethod as keyof typeof methodLabels].toLowerCase()}{' '}
              method and that my order will be processed once payment is received.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!confirmed || processing || disabled || !allowPayLater}
              className="flex-1 bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {processing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Placing order...
                </>
              ) : (
                allowPayLater ? 'Place order — pay later' : 'Awaiting payment confirmation'
              )}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={processing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default OfflinePayment;
