// @ts-nocheck — base-app compiles without strict mode; kept as-is rather than retyped.
// from base-app/src/components/payment-gateways/stripe/stripe-checkout-form.tsx — ported verbatim; only import paths rewired.
import React from 'react';
import {
  PaymentElement,
  LinkAuthenticationElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { toast } from '@/modules/store/shims/sonner';

/**
 * `onSuccess` is what makes this usable for anything other than the cart.
 *
 * Without it the form always redirected to the cart's success page, whatever was
 * being paid — so paying an invoice charged the card and then landed the
 * customer on a page that wants a cart, which said "Checkout data not found.
 * Your payment was processed but we cannot complete your order." The money was
 * taken and nothing was recorded against the invoice.
 *
 * With a callback we ask Stripe to redirect only if the payment method demands
 * it (`redirect: 'if_required'`), so a card settles in place and the caller —
 * which knows WHAT was paid — records it.
 */
export const StripeCheckoutForm = ({
  customer,
  onSuccess,
  returnUrl
}: {
  customer?: any;
  onSuccess?: (result: any) => void;
  returnUrl?: string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!stripe) {
      return;
    }
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );
    if (!clientSecret) {
      return;
    }
    stripe
      .retrievePaymentIntent(clientSecret)
      .then(({ paymentIntent, error }) => {
        if (error || !paymentIntent) {
          setMessage('Unable to retrieve the payment status.');
          return;
        }
        switch (paymentIntent.status) {
          case 'succeeded':
            setMessage('Payment succeeded!');
            break;
          case 'processing':
            setMessage('Your payment is processing.');
            break;
          case 'requires_payment_method':
            setMessage('Your payment was not successful, please try again.');
            break;
          default:
            setMessage('Something went wrong.');
            break;
        }
      })
      .catch(() => {
        setMessage('Unable to retrieve the payment status.');
      });
  }, [stripe]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      // Make sure to disable form submission until Stripe.js has loaded.
      return;
    }

    setIsLoading(true);
    setMessage(null);
    try {
      const confirmParams = {
        // Elements already contains the client secret from StripePayment.
        return_url:
          returnUrl || `${window.location.origin}${window.location.pathname.replace(/\/$/, '')}/success` // Appmint One: /{storePage}/checkout/success
      };
      // Stripe has separate overloads for callback results and mandatory redirects.
      // Keep each call explicit so its input and result match the SDK contract.
      const result = onSuccess
        ? await stripe.confirmPayment({
            elements,
            confirmParams,
            redirect: 'if_required'
          })
        : await stripe.confirmPayment({ elements, confirmParams });
      const { error } = result;
      const paymentIntent =
        'paymentIntent' in result ? result.paymentIntent : undefined;

      if (
        !error &&
        paymentIntent &&
        ['succeeded', 'processing', 'requires_capture'].includes(
          paymentIntent.status
        )
      ) {
        setIsLoading(false);
        onSuccess?.({
          success: true,
          status: paymentIntent.status,
          payment_intent_id: paymentIntent.id,
          transaction_id: paymentIntent.id,
          amount:
            typeof paymentIntent.amount === 'number'
              ? paymentIntent.amount / 100
              : undefined,
          currency: paymentIntent.currency,
          metadata: { gateway: 'stripe' }
        });
        return;
      }

      if (!error) {
        // Redirect-based method: Stripe is taking the customer away.
        return;
      }

      // This point will only be reached if there is an immediate error when
      // confirming the payment. Otherwise, your customer will be redirected to
      // your `return_url`. For some payment methods like iDEAL, your customer will
      // be redirected to an intermediate site first to authorize the payment, then
      // redirected to the `return_url`..
      toast.error('Payment was not successful, please try again');
      if (error.type === 'card_error' || error.type === 'validation_error') {
        setMessage(error.message);
      } else {
        setMessage('An unexpected error occurred.');
      }
    } catch {
      setMessage(
        'Unable to confirm the payment. Please check your payment status before trying again.'
      );
      toast.error('Unable to confirm payment');
    } finally {
      setIsLoading(false);
    }
  };

  const paymentElementOptions = {
    layout: 'tabs'
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      {!customer?.email && (
        <LinkAuthenticationElement
          id="link-authentication-element"
          onChange={(e) => setEmail(e.value.email)}
        />
      )}
      <PaymentElement
        id="payment-element"
        options={paymentElementOptions as any}
      />
      <button
        disabled={isLoading || !stripe || !elements}
        id="submit"
        className="w-full disabled:opacity-50 mt-5 text-white bg-slate-900 rounded-md flex justify-center items-center transition duration-300 hover:bg-slate-800 py-3 px-4 font-medium"
      >
        <span id="button-text">
          {isLoading ? <div className="spinner" id="spinner"></div> : 'Pay now'}
        </span>
      </button>
      {/* Show any error or success messages */}
      {message && <div id="payment-message">{message}</div>}
    </form>
  );
};
