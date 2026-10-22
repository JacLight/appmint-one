'use client';
// from base-app/src/components/events/EventCheckoutSuccess.tsx — logic kept; imports, engine wiring (server actions → src/api/events.ts) and theme tokens adapted.
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { eventsAPI as storefrontAPI } from './events-client';
import { IconRenderer } from './icon-renderer';

interface EventCheckoutSuccessProps {
  eventsPage?: string;
}

export const EventCheckoutSuccess: React.FC<EventCheckoutSuccessProps> = ({ eventsPage = 'events' }) => {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);

  const bookingId = searchParams?.get('bookingId') || '';
  const email = searchParams?.get('email') || '';
  const paymentIntent = searchParams?.get('payment_intent') || '';
  const redirectStatus = searchParams?.get('redirect_status') || '';

  useEffect(() => {
    if (!bookingId || !paymentIntent) {
      setError('Missing booking or payment information.');
      setStatus('error');
      return;
    }

    if (redirectStatus && redirectStatus !== 'succeeded') {
      setError(`Payment ${redirectStatus}. Please try again.`);
      setStatus('error');
      return;
    }

    const confirmOrder = async () => {
      try {
        const result = await storefrontAPI.confirmEventOrder({
          bookingId,
          paymentRef: paymentIntent,
          paymentGateway: 'stripe',
        });

        if (result?.booking) {
          setBooking(result.booking);
          setTickets(result.tickets || []);
          setStatus('success');
        } else {
          setError('Could not confirm your booking. Please contact support with reference: ' + paymentIntent);
          setStatus('error');
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to confirm booking. Your payment was received — please contact support.');
        setStatus('error');
      }
    };

    confirmOrder();
  }, [bookingId, paymentIntent, redirectStatus]);

  if (status === 'processing') {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-[var(--text)] mb-2">Confirming your booking...</h2>
        <p className="text-sm text-[var(--muted)]">Please wait while we process your payment.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <IconRenderer icon="AlertCircle" className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-[var(--text)] mb-2">Something went wrong</h2>
        <p className="text-sm text-[var(--text-2)] mb-4">{error}</p>
        <a
          href={`/${eventsPage}`}
          className="inline-block px-6 py-3 bg-[var(--primary)] text-[var(--primary-ink)] font-medium rounded-lg hover:bg-[var(--primary-strong)] transition-colors"
        >
          Back to Events
        </a>
      </div>
    );
  }

  const bk = booking?.data || booking;
  const bkId = booking?.sk || bk?.bookingRef || bookingId;

  return (
    <div className="max-w-lg mx-auto py-16 text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <IconRenderer icon="Check" className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-[var(--text)] mb-2">Tickets Confirmed!</h2>
      <p className="text-[var(--text-2)] mb-2">
        {tickets.length} ticket{tickets.length !== 1 ? 's' : ''} issued for <strong>{bk?.eventName || 'your event'}</strong>.
      </p>
      <p className="text-sm text-[var(--muted)] mb-6">
        A confirmation email with your tickets and QR codes has been sent to <strong>{email || bk?.buyerEmail}</strong>.
      </p>

      <a
        href={`/${eventsPage}/booking?bookingId=${encodeURIComponent(bkId)}&email=${encodeURIComponent(email || bk?.buyerEmail || '')}`}
        className="inline-block px-6 py-3 bg-[var(--primary)] text-[var(--primary-ink)] font-medium rounded-lg hover:bg-[var(--primary-strong)] transition-colors"
      >
        View Your Tickets
      </a>
    </div>
  );
};

export default EventCheckoutSuccess;
