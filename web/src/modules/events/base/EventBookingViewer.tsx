'use client';
// from base-app/src/components/events/EventBookingViewer.tsx — logic kept; imports, engine wiring (server actions → src/api/events.ts) and theme tokens adapted.
import React, { useState, useEffect } from 'react';
import { eventsAPI as storefrontAPI } from './events-client';
import { IconRenderer } from './icon-renderer';
import { getResponseErrorMessage } from '@/lib-client/helpers';
import { MobileTicketPanel } from './MobileTicketPanel';
import { getEventImageUrl, getEventImageUrls } from './event-image';

const formatDate = (d: string | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (amount: number | undefined) => {
  if (amount == null || amount === 0) return 'Free';
  return `$${Number(amount).toFixed(2)}`;
};

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  checked_in: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-[var(--bg-2)] text-[var(--text-2)]',
  transferred: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
};

const formatStatus = (s: string) => s?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';

interface EventBookingViewerProps {
  email?: string;
  bookingId?: string;
  slug?: string;
}

export const EventBookingViewer: React.FC<EventBookingViewerProps> = ({ email: initialEmail, bookingId: initialBookingId, slug }) => {
  const [email, setEmail] = useState(initialEmail || '');
  const [bookingId, setBookingId] = useState(initialBookingId || '');
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ticket detail
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [ticketEvent, setTicketEvent] = useState<any>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Transfer
  const [transferEmail, setTransferEmail] = useState('');
  const [transferName, setTransferName] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<string | null>(null);

  const fetchBooking = async (e?: string, b?: string) => {
    const emailVal = e || email;
    const bookingVal = b || bookingId;
    if (!emailVal.trim() || !bookingVal.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await storefrontAPI.getEventBooking(emailVal.trim(), bookingVal.trim());
      if (!result || !result.booking) {
        setError('Booking not found. Check your email and booking ID.');
      } else {
        setBooking(result);
      }
    } catch (err: any) {
      setError(getResponseErrorMessage(err, 'Could not find booking'));
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch if props provided
  useEffect(() => {
    if (initialEmail && initialBookingId) {
      fetchBooking(initialEmail, initialBookingId);
    }
  }, [initialEmail, initialBookingId]);

  const handleViewTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    setTransferResult(null);
    setTicketEvent(null);
    const td = ticket.data || ticket;
    const eventId = td.event || td.eventId || td.eventSk;
    if (eventId) {
      try {
        const res = await storefrontAPI.getEventDetail(eventId);
        setTicketEvent(res?.event || res);
      } catch {
        // ignore — fall back to whatever is denormalized on the ticket
      }
    }
  };

  const handleTransfer = async () => {
    const ticketId = selectedTicket?.sk || selectedTicket?.id || selectedTicket?.data?.ticketId;
    if (!ticketId || !transferEmail.trim()) return;
    setTransferring(true);
    try {
      await storefrontAPI.transferEventTicket(ticketId, { email: transferEmail.trim(), name: transferName.trim() || undefined });
      setTransferResult('Ticket transferred successfully!');
      setTransferEmail('');
      setTransferName('');
      // Refresh booking
      await fetchBooking();
    } catch (err: any) {
      setTransferResult(getResponseErrorMessage(err, 'Transfer failed'));
    } finally {
      setTransferring(false);
    }
  };

  // Ticket detail view
  if (selectedTicket) {
    const t = selectedTicket.data || selectedTicket;
    const ticketId = selectedTicket.sk || selectedTicket.id || t.ticketId;
    const status = t.status || 'confirmed';
    // Match backend policy: block only terminal/used states. `confirmed` alone
    // was too strict — hid the button for `transferred` (re-transfer), `pending`,
    // `paid`, etc.
    const canTransfer = !['cancelled', 'refunded', 'checked_in'].includes(status);
    const eventImages = getEventImageUrls(ticketEvent);
    const heroImage = eventImages[0] || getEventImageUrl(selectedTicket);
    const galleryImages = eventImages.slice(1);
    const eventData = ticketEvent?.data || ticketEvent || {};

    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => { setSelectedTicket(null); setTicketEvent(null); }} className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6">
          <IconRenderer icon="ArrowLeft" className="w-4 h-4" />
          Back to booking
        </button>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Hero banner */}
          {heroImage && (
            <div className="h-48 md:h-60 bg-[var(--bg-2)]">
              <img src={heroImage} alt={t.eventName || eventData.name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Mobile-only QR panel */}
          <div className="p-6 border-b border-[var(--border)]">
            <MobileTicketPanel
              ticketId={ticketId}
              holderName={t.holderName || t.holderEmail}
              ticketTypeName={t.ticketTypeName || 'General'}
              ticketTypeColor={t.ticketTypeColor}
            />
          </div>

          {/* Info */}
          <div className="p-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Event</span>
              <span className="font-medium text-[var(--text)]">{t.eventName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Ticket Type</span>
              <span className="text-[var(--text)]">{t.ticketTypeName || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Holder</span>
              <span className="text-[var(--text)]">{t.holderName || t.holderEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Status</span>
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[status] || 'bg-[var(--bg-2)] text-[var(--text-2)]'}`}>
                {formatStatus(status)}
              </span>
            </div>
            {ticketId && (
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Ticket ID</span>
                <span className="font-mono text-[var(--text)] text-xs">{ticketId}</span>
              </div>
            )}
          </div>

          {/* Gallery */}
          {galleryImages.length > 0 && (
            <div className="px-6 pb-4">
              <h4 className="text-sm font-semibold text-[var(--text)] mb-2">Gallery</h4>
              <div className="grid grid-cols-3 gap-2">
                {galleryImages.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxImage(url)}
                    className="aspect-square overflow-hidden rounded-lg bg-[var(--bg-2)] hover:opacity-90 transition"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Event description */}
          {eventData.description && (
            <div className="px-6 pb-4">
              <h4 className="text-sm font-semibold text-[var(--text)] mb-2">About the event</h4>
              <div className="prose prose-sm max-w-none text-[var(--text-2)]" dangerouslySetInnerHTML={{ __html: eventData.description }} />
            </div>
          )}

          {/* Perks */}
          {t.perks && t.perks.length > 0 && (
            <div className="px-6 pb-4">
              <h4 className="text-sm font-semibold text-[var(--text)] mb-2">Included Perks</h4>
              <div className="flex flex-wrap gap-2">
                {t.perks.map((perk: any, i: number) => (
                  <span key={i} className="text-xs px-2 py-1 bg-[var(--bg-2)] text-[var(--text-2)] rounded">{perk.name || perk}</span>
                ))}
              </div>
            </div>
          )}

          {/* Transfer */}
          {canTransfer && (
            <div className="p-6 border-t border-[var(--border)]">
              <h4 className="text-sm font-semibold text-[var(--text)] mb-3">Transfer this ticket</h4>
              <div className="space-y-2">
                <input
                  type="email"
                  placeholder="Recipient email *"
                  value={transferEmail}
                  onChange={(e) => setTransferEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                />
                <input
                  type="text"
                  placeholder="Recipient name (optional)"
                  value={transferName}
                  onChange={(e) => setTransferName(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                />
                {transferResult && <p className={`text-sm ${transferResult.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{transferResult}</p>}
                <button
                  onClick={handleTransfer}
                  disabled={transferring || !transferEmail.trim()}
                  className="w-full py-2.5 bg-[var(--primary)] text-[var(--primary-ink)] text-sm font-medium rounded-lg hover:bg-[var(--primary-strong)] disabled:opacity-50"
                >
                  {transferring ? 'Transferring...' : 'Transfer'}
                </button>
              </div>
            </div>
          )}
        </div>

        {lightboxImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <img src={lightboxImage} alt="" className="max-w-full max-h-full object-contain" />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
              aria-label="Close"
            >
              <IconRenderer icon="X" className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Booking search / view
  if (!booking) {
    return (
      <div className="max-w-md mx-auto py-12 px-6">
        <div className="text-center mb-8">
          <IconRenderer icon="Ticket" className="w-12 h-12 text-[var(--faint)] mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-[var(--text)] mb-2">View Your Booking</h2>
          <p className="text-[var(--muted)] text-sm">Enter the email and reference from your confirmation email.</p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
          />
          <input
            type="text"
            placeholder="Booking ID or reference code"
            value={bookingId}
            onChange={(ev) => setBookingId(ev.target.value)}
            className="w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
          />
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <button
            onClick={() => fetchBooking()}
            disabled={loading || !email.trim() || !bookingId.trim()}
            className="w-full py-3 bg-[var(--primary)] text-[var(--primary-ink)] font-medium rounded-lg hover:bg-[var(--primary-strong)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Looking up...' : 'Find Booking'}
          </button>
        </div>
      </div>
    );
  }

  // Booking found — response is { booking, tickets }
  const b = booking.booking?.data || booking.booking || booking;
  const tickets = booking.tickets || [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--text)]">{b.eventName || 'Event Booking'}</h2>
            <p className="text-sm text-[var(--muted)] mt-0.5">Ref: {b.bookingRef || b.referenceCode || booking.booking?.sk || bookingId}</p>
          </div>
          <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${statusColors[b.status] || 'bg-[var(--bg-2)] text-[var(--text-2)]'}`}>
            {formatStatus(b.status || 'confirmed')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-[var(--muted)]">Buyer</span>
            <p className="font-medium text-[var(--text)]">{b.buyerName || b.name}</p>
            <p className="text-[var(--muted)]">{b.buyerEmail || b.email}</p>
          </div>
          <div className="text-right">
            <span className="text-[var(--muted)]">Total</span>
            <p className="text-xl font-bold text-[var(--text)]">{formatCurrency(b.totalAmount || b.total)}</p>
          </div>
        </div>
      </div>

      <h3 className="font-semibold text-[var(--text)] mb-3">Tickets ({tickets.length})</h3>
      <div className="space-y-3">
        {tickets.map((ticket: any, idx: number) => {
          const t = ticket.data || ticket;
          const status = t.status || 'confirmed';
          return (
            <button
              key={ticket.sk || idx}
              onClick={() => handleViewTicket(ticket)}
              className="w-full text-left bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 hover:shadow-md transition-shadow flex items-center gap-4"
            >
              <div className="w-1.5 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: t.ticketTypeColor || '#6B7280' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-[var(--text)]">{t.ticketTypeName || 'Ticket'}</h4>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[status] || 'bg-[var(--bg-2)] text-[var(--text-2)]'}`}>
                    {formatStatus(status)}
                  </span>
                </div>
                <p className="text-sm text-[var(--muted)] mt-0.5">{t.holderName || t.holderEmail || 'Unassigned'}</p>
              </div>
              <IconRenderer icon="ChevronRight" className="w-5 h-5 text-[var(--faint)] flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EventBookingViewer;
