// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
// from base-app/src/components/payment-gateways/stripe/stripe-payment.tsx — ported verbatim; only import paths rewired.
import React, { useEffect, useState } from 'react';
import { getAppEngineClient } from '@/modules/store/lib/appmint-client';
import { API_ENDPOINTS } from '@/modules/store/lib/appmint-endpoints';
import { getResponseErrorMessage } from '@/modules/store/lib-client/helpers';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { StripeCheckoutForm } from './stripe-checkout-form';
import { CustomLoader } from '@/modules/store/components/common/custom-loader';

export const StripePayment = ({
  customer,
  amount,
  onSuccess,
  onError,
  disabled,
  metadata
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState('');
  const [stripePromise, setStripePromise] = useState<ReturnType<
    typeof loadStripe
  > | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');
    setClientSecret('');
    (async () => {
      try {
        const intent = await getAppEngineClient().processRequest(
          'post',
          API_ENDPOINTS.STORE_CHECKOUT_STRIPE_PAY_INTENT,
          {
            email: customer?.email,
            amount: amount?.amount,
            currency: amount?.currency,
            // A checkout names its stored cart; the server refuses an amount that is not its total.
            ...(amount?.cartId ? { cartId: amount.cartId, partial: !!amount.partial } : {})
          }
        );
        if (!intent?.publishableKey || !intent?.client_secret)
          throw new Error(
            'Card payment could not be initialized. Please try again.'
          );
        if (active) {
          setStripePromise(loadStripe(intent.publishableKey));
          setClientSecret(intent.client_secret);
        }
      } catch (error) {
        if (active)
          setError(
            getResponseErrorMessage(error) ||
              'Card payment is temporarily unavailable.'
          );
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [customer?.email, amount?.amount, amount?.currency, amount?.cartId, attempt]);

  if (isLoading) return <CustomLoader />;
  if (error)
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4"
      >
        <p className="text-sm text-red-800">{error}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setAttempt((value) => value + 1)}
          className="mt-3 rounded border px-4 py-2"
        >
          Retry card payment
        </button>
      </div>
    );
  return (
    <div className="checkout-payment-gateway stripe-checkout">
      {clientSecret && stripePromise && (
        <Elements
          options={{ clientSecret, appearance: { theme: 'stripe' } }}
          stripe={stripePromise}
        >
          <StripeCheckoutForm customer={customer} onSuccess={onSuccess} />
        </Elements>
      )}
    </div>
  );
};
