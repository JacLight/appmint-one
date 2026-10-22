'use client';
// from base-app/src/components/events/EventCheckout.tsx — logic kept; imports, engine wiring (server actions → src/api/events.ts) and theme tokens adapted.
import React, { useState, useEffect } from 'react';
import { eventsAPI } from './events-client';
import { IconRenderer } from './icon-renderer';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getResponseErrorMessage } from '@/lib-client/helpers';

let stripePromise: any;

const formatCurrency = (amount: number | undefined, currency?: string) => {
  if (amount == null || amount === 0) return 'Free';
  return `$${Number(amount).toFixed(2)}`;
};

// --- Stripe Form ---

const EventStripeForm = ({ returnUrl }: { returnUrl: string }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (error) {
      setMessage(error.type === 'card_error' || error.type === 'validation_error' ? error.message || 'Payment failed' : 'An unexpected error occurred.');
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="submit"
        disabled={isLoading || !stripe || !elements}
        className="w-full py-3 bg-[var(--primary)] text-[var(--primary-ink)] font-medium rounded-lg hover:bg-[var(--primary-strong)] transition-colors disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : 'Pay Now'}
      </button>
      {message && <p className="text-sm text-red-600">{message}</p>}
    </form>
  );
};

// --- Main Checkout ---

interface EventCheckoutProps {
  booking: any;
  tickets?: any[];
  eventsPage?: string;
  eventName?: string;
}

export const EventCheckout: React.FC<EventCheckoutProps> = ({ booking, tickets = [], eventsPage = 'events', eventName }) => {
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bk = booking?.data || booking;
  const bookingId = booking?.sk || bk?.bookingRef;
  const total = bk?.totalAmount || bk?.total || 0;
  const email = bk?.buyerEmail || bk?.email;
  const lines: any[] = Array.isArray(bk?.productItems) && bk.productItems.length
    ? bk.productItems
    : tickets.map((t: any) => { const td = t.data || t; return { name: td.ticketTypeName, quantity: 1, amount: td.price }; });
  const ticketCount = lines.reduce((n: number, l: any) => n + (Number(l.quantity) || 1), 0);

  useEffect(() => {
    if (!bookingId || total <= 0) {
      setLoading(false);
      return;
    }

    const initPayment = async () => {
      try {
        // The server prices the payment from the booking itself.
        const payload = { bookingId };
        const result = await eventsAPI.createEventStripeIntent(payload);
        if (result?.publishableKey && result?.client_secret) {
          stripePromise = loadStripe(result.publishableKey);
          setClientSecret(result.client_secret);
        } else {
          setError('Could not initialize payment');
        }
      } catch (err: any) {
        setError(getResponseErrorMessage(err, 'Payment initialization failed'));
      } finally {
        setLoading(false);
      }
    };

    initPayment();
  }, [bookingId, total]);

  // Build return URL for after Stripe redirect
  const returnUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${eventsPage}/checkout/success?bookingId=${encodeURIComponent(bookingId)}&email=${encodeURIComponent(email || '')}`
    : '';

  if (loading) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto" />
        <p className="text-sm text-[var(--muted)] mt-3">Preparing payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center">
        <IconRenderer icon="AlertCircle" className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <h2 className="text-2xl font-bold text-[var(--text)] mb-2">Complete Your Purchase</h2>
      <p className="text-[var(--muted)] text-sm mb-6">
        {eventName || bk?.eventName || 'Event'} — {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}{bk?.bookingRef ? ` · Booking ${bk.bookingRef}` : ''}
      </p>

      {/* Order summary: the booking's own lines (tickets are issued once payment is confirmed) */}
      <div className="bg-[var(--bg-2)] rounded-lg p-4 mb-6 space-y-2">
        {lines.map((l: any, idx: number) => (
          <div key={l.sku || idx} className="flex justify-between text-sm">
            <span className="text-[var(--text-2)]">{l.quantity > 1 ? `${l.quantity} × ` : ''}{l.name || 'Ticket'}</span>
            <span className="text-[var(--text)] font-medium">{formatCurrency(l.amount)}</span>
          </div>
        ))}
        <div className="border-t border-[var(--border)] pt-2 mt-2 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Stripe payment */}
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#ff4d6d' } } }}>
          <EventStripeForm returnUrl={returnUrl} />
        </Elements>
      ) : (
        <p className="text-sm text-[var(--muted)] text-center">No payment required.</p>
      )}
    </div>
  );
};

export default EventCheckout;
