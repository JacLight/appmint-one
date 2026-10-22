'use client';
// from base-app/src/components/my-account/Events.tsx — logic kept; imports, engine wiring (server actions → src/api/events.ts) and theme tokens adapted.
import React, { useState, useEffect, useCallback } from 'react';
import { IconRenderer } from './icon-renderer';
import { eventsAPI as storefrontAPI } from './events-client';
import { getResponseErrorMessage } from '@/lib-client/helpers';
import { getEventImageUrl, getEventImageUrls, getPersonImageUrl } from './event-image';
import { MobileTicketPanel } from './MobileTicketPanel';
import { LiveQr } from './live-qr';

// --- Helpers ---

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  checked_in: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-[var(--bg-2)] text-[var(--text-2)]',
  transferred: 'bg-purple-100 text-purple-700',
  paid: 'bg-green-100 text-green-700',
  published: 'bg-green-100 text-green-700',
  draft: 'bg-[var(--bg-2)] text-[var(--text-2)]',
  upcoming: 'bg-blue-100 text-blue-700',
  completed: 'bg-[var(--bg-2)] text-[var(--text-2)]',
  live: 'bg-emerald-100 text-emerald-700',
};

const formatStatus = (s: string) => s?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '';

const formatDate = (d: string | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (d: string | undefined) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatCurrency = (amount: number | undefined, currency?: string) => {
  if (amount == null) return 'Free';
  if (amount === 0) return 'Free';
  return `${currency || '$'}${Number(amount).toFixed(2)}`;
};

// --- Main Component ---

export const Events: React.FC<{ data: any }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'events'>('tickets');
  const [tickets, setTickets] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Transfer state
  const [transferEmail, setTransferEmail] = useState('');
  const [transferName, setTransferName] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);

  // Perks state
  const [perks, setPerks] = useState<any>(null);

  // Full event detail for the selected ticket (tickets only store an event ref,
  // so we fetch the event to get coverImage, images[], description, venue, etc.)
  // The backend enriches the event record with participants, sessions,
  // ticketTypes, badgeTemplates, and totalTickets, so we don't need extra calls.
  const [ticketEvent, setTicketEvent] = useState<any>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (!data?.customer && !data?.user) return;
    try {
      const result = await storefrontAPI.getMyEventTickets();
      setTickets(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error('Could not load my tickets:', getResponseErrorMessage(err));
      setTickets([]);
    }
  }, [data]);

  const loadEvents = useCallback(async () => {
    try {
      const result = await storefrontAPI.getEvents({ limit: 50, fromDate: "" }); // every event, past ones too, to name the tickets
      setEvents(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error('Could not load events:', getResponseErrorMessage(err));
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadTickets(), loadEvents()]);
      setLoading(false);
    };
    load();
  }, [loadTickets, loadEvents]);

  const handleSelectTicket = async (ticket: any) => {
    setSelectedTicket(ticket);
    setSelectedEvent(null);
    setTransferSuccess(false);
    setTransferError(null);
    setTransferEmail('');
    setTransferName('');
    setPerks(null);
    setTicketEvent(null);

    const td = ticket.data || ticket;
    const ticketId = ticket.sk || ticket.id || td.ticketId;
    const eventId = td.event || td.eventId || td.eventSk;

    // Load perks + full event in parallel. The event record comes enriched
    // with participants/sessions/ticketTypes/badgeTemplates from the backend.
    // These are non-blocking enhancements — the ticket info still renders if
    // either fails — but we log the reason so issues are never silent.
    await Promise.all([
      ticketId
        ? storefrontAPI
            .getEventTicketPerks(ticketId)
            .then(setPerks)
            .catch((err: any) => console.error('Could not load ticket perks', ticketId, getResponseErrorMessage(err)))
        : Promise.resolve(),
      eventId
        ? storefrontAPI
            .getEventDetail(eventId)
            .then((res) => setTicketEvent(res?.event || res))
            .catch((err: any) => console.error('Could not load event detail', eventId, getResponseErrorMessage(err)))
        : Promise.resolve(),
    ]);
  };

  // IMPORTANT: ticketId must be passed in, not read from state. Previously this
  // relied on a setTransferTicketId() call made in the same tick as the
  // handler invocation, which meant the state update hadn't landed yet and the
  // early-return `if (!transferTicketId) return` always fired — transfer
  // silently did nothing.
  const handleTransfer = async (ticketId: string) => {
    if (!ticketId || !transferEmail.trim()) return;
    setTransferring(true);
    setTransferError(null);
    try {
      await storefrontAPI.transferEventTicket(ticketId, {
        email: transferEmail.trim(),
        name: transferName.trim() || undefined,
      });
      setTransferSuccess(true);
      setTransferEmail('');
      setTransferName('');
      await loadTickets();
    } catch (err: any) {
      setTransferError(getResponseErrorMessage(err, 'Transfer failed'));
    } finally {
      setTransferring(false);
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter((t) => {
    const d = t.data || t;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      (d.eventName || '').toLowerCase().includes(q) ||
      (d.ticketTypeName || '').toLowerCase().includes(q) ||
      (d.holderName || '').toLowerCase().includes(q) ||
      (t.sk || '').toLowerCase().includes(q)
    );
  });

  // Filter events
  const filteredEvents = events.filter((e) => {
    const d = e.data || e;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      (d.title || d.name || '').toLowerCase().includes(q) ||
      (d.type || '').toLowerCase().includes(q) ||
      (d.venue?.name || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-[var(--border)] rounded w-48" />
          <div className="h-4 bg-[var(--border)] rounded w-72" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-[var(--border)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Ticket Detail View ---
  if (selectedTicket) {
    const t = selectedTicket.data || selectedTicket;
    const ticketId = selectedTicket.sk || selectedTicket.id || t.ticketId;
    const status = t.status || 'confirmed';
    // Backend only blocks transfer when the ticket type has allowTransfer===false
    // or the ticket is in a terminal/used state. Mirror that here — previously
    // we required status==='confirmed', which hid the button for paid/pending
    // tickets and, worse, blocked re-transfers (status flips to 'transferred'
    // after the first successful assignment).
    const blockedStatuses = ['cancelled', 'refunded', 'checked_in'];
    const canTransfer = !blockedStatuses.includes(status) && t.transferable !== false;

    const eventImages = getEventImageUrls(ticketEvent);
    const heroImage = eventImages[0] || getEventImageUrl(selectedTicket);
    const galleryImages = eventImages.slice(1);
    const eventData = ticketEvent?.data || ticketEvent || {};

    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <button
          onClick={() => { setSelectedTicket(null); setPerks(null); setTicketEvent(null); }}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6"
        >
          <IconRenderer icon="ArrowLeft" className="w-4 h-4" />
          Back to tickets
        </button>

        {/* Hero banner */}
        {heroImage && (
          <div className="h-56 md:h-72 rounded-xl overflow-hidden mb-6 bg-[var(--bg-2)]">
            <img src={heroImage} alt={t.eventName || eventData.name} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Ticket stub + event info */}
          <div className="space-y-6">
            {/* ── TICKET STUB ─────────────────────────────────────────── */}
            {(() => {
              const ttColor = t.ticketTypeColor || '#6B21A8';
              const startDate = eventData.startDate || eventData.date || t.eventDate;
              const endDate = eventData.endDate;
              const startTime = eventData.startTime || eventData.time;
              const endTime = eventData.endTime;
              const venue = eventData.venue || t.venue || {};
              const eventName = eventData.title || eventData.name || t.eventName || 'Event Ticket';
              return (
                <div className="relative overflow-hidden rounded-2xl shadow-lg bg-[var(--surface)]">
                  {/* Colored header bar */}
                  <div
                    className="px-6 py-5 text-white"
                    style={{ background: `linear-gradient(135deg, ${ttColor} 0%, ${ttColor}dd 100%)` }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Admit One</p>
                        <h1 className="text-2xl md:text-3xl font-bold leading-tight truncate">{eventName}</h1>
                        <p className="mt-1 text-sm opacity-90">{t.ticketTypeName || 'General Admission'}</p>
                      </div>
                      <span className={`inline-flex flex-shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full bg-white/20 backdrop-blur-sm`}>
                        {formatStatus(status)}
                      </span>
                    </div>
                  </div>

                  {/* Body: date / time / venue in tile row */}
                  <div className="px-6 py-5 grid grid-cols-3 gap-3 border-b border-dashed border-[var(--border)]">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">Date</p>
                      <p className="text-sm font-semibold text-[var(--text)]">{formatDate(startDate)}</p>
                      {endDate && endDate !== startDate && (
                        <p className="text-[11px] text-[var(--muted)]">to {formatDate(endDate)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">Time</p>
                      <p className="text-sm font-semibold text-[var(--text)]">{(startTime && /T\d/.test(startTime) ? formatTime(startTime) : startTime) || formatTime(startDate) || '—'}</p>
                      {endTime && <p className="text-[11px] text-[var(--muted)]">to {/T\d/.test(endTime) ? formatTime(endTime) : endTime}</p>}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">Venue</p>
                      <p className="text-sm font-semibold text-[var(--text)] truncate">{venue.name || '—'}</p>
                      {venue.city && <p className="text-[11px] text-[var(--muted)] truncate">{venue.city}</p>}
                    </div>
                  </div>

                  {/* Perforation notches */}
                  <div className="relative h-6 bg-[var(--bg-2)]">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--surface)]" />
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[var(--surface)]" />
                    <div
                      className="absolute inset-0 flex items-center px-8"
                      aria-hidden="true"
                    >
                      <div className="w-full border-t border-dashed border-[var(--border)]" />
                    </div>
                  </div>

                  {/* Stub: holder + ticket id + prominent Get Ticket CTA */}
                  <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Holder</p>
                        <p className="font-semibold text-[var(--text)] truncate">{t.holderName || t.holderEmail || '—'}</p>
                        {t.holderEmail && t.holderName && (
                          <p className="text-[11px] text-[var(--muted)] truncate">{t.holderEmail}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Ticket</p>
                        <p className="font-mono text-xs text-[var(--text)] truncate">{ticketId}</p>
                        {(t.zone || t.seatNumber) && (
                          <p className="text-[11px] text-[var(--muted)]">{[t.zone, t.seatNumber].filter(Boolean).join(' · ')}</p>
                        )}
                      </div>
                    </div>

                    <a
                      href="#get-ticket"
                      className="block w-full text-center py-3 rounded-lg text-white text-sm font-semibold border border-[var(--border)] hover:opacity-95 transition"
                      style={{ backgroundColor: ttColor }}
                    >
                      Get Ticket →
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* Perks */}
            {perks && Array.isArray(perks.perks) && perks.perks.length > 0 && (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
                <h3 className="text-base font-semibold text-[var(--text)] mb-4">Perks</h3>
                <div className="space-y-3">
                  {perks.perks.map((perk: any, idx: number) => (
                    <div key={perk.id || idx} className="flex items-center justify-between p-3 bg-[var(--bg-2)] rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-[var(--text)]">{perk.name || perk.title}</p>
                        {perk.description && <p className="text-xs text-[var(--muted)]">{perk.description}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        perk.fullyFulfilled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {perk.claimed || 0}/{perk.total || 1} used
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery */}
            {galleryImages.length > 0 && (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
                <h3 className="text-base font-semibold text-[var(--text)] mb-4">Gallery</h3>
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
            {(eventData.description || eventData.shortDescription) && (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
                <h3 className="text-base font-semibold text-[var(--text)] mb-3">About the event</h3>
                {eventData.shortDescription && (
                  <div className="prose prose-sm max-w-none text-sm text-[var(--text-2)] mb-3" dangerouslySetInnerHTML={{ __html: eventData.shortDescription }} />
                )}
                {eventData.description && (
                  <div
                    className="prose prose-sm max-w-none text-[var(--text-2)]"
                    dangerouslySetInnerHTML={{ __html: eventData.description }}
                  />
                )}
              </div>
            )}

            {/* Participants — grouped by type (speakers, sponsors, exhibitors, …)
                Read from the enriched event record — backend attaches the full
                participants array to event.data.participants. */}
            {Array.isArray(eventData.participants) && eventData.participants.length > 0 && (() => {
              const groups: Record<string, any[]> = {};
              for (const p of eventData.participants) {
                const pd = p.data || p;
                const key = (pd.type || 'participant').toLowerCase();
                (groups[key] = groups[key] || []).push(p);
              }
              // Display order: speakers first, then sponsors, then everything else
              const orderedKeys = Object.keys(groups).sort((a, b) => {
                const prio = (k: string) =>
                  ({ speaker: 0, keynote: 0, sponsor: 1, exhibitor: 2, vip: 3, press: 4, volunteer: 5, attendee: 9 }[k] ?? 6);
                return prio(a) - prio(b);
              });
              const labelFor = (k: string) => {
                const pluralized = k.endsWith('s') ? k : `${k}s`;
                return pluralized.replace(/\b\w/g, (c) => c.toUpperCase());
              };
              return (
                <div className="space-y-4">
                  {orderedKeys.map((key) => (
                    <div key={key} className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--text)]">{labelFor(key)}</h3>
                        <span className="text-xs text-[var(--muted)]">{groups[key].length}</span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {groups[key].map((p: any, idx: number) => {
                          const pd = p.data || p;
                          const img = getPersonImageUrl(p);
                          const name =
                            [pd.firstName, pd.lastName].filter(Boolean).join(' ') ||
                            pd.name ||
                            pd.email ||
                            'Guest';
                          return (
                            <div
                              key={p.sk || idx}
                              className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--bg-2)] transition"
                            >
                              <div className="w-12 h-12 rounded-full bg-[var(--bg-2)] flex-shrink-0 overflow-hidden flex items-center justify-center">
                                {img ? (
                                  <img src={img} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                  <IconRenderer icon="User" className="w-5 h-5 text-[var(--muted)]" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-[var(--text)] truncate">{name}</p>
                                  {pd.featured && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Featured</span>
                                  )}
                                </div>
                                {pd.role && <p className="text-xs text-[var(--muted)] capitalize truncate">{pd.role}</p>}
                                {pd.shortBio && (
                                  <p className="text-xs text-[var(--text-2)] mt-1 line-clamp-2">{pd.shortBio}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Transfer */}
            {canTransfer && (
              <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6">
                <h3 className="text-base font-semibold text-[var(--text)] mb-4">Transfer Ticket</h3>
                {transferSuccess ? (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                    Ticket transferred successfully!
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      <input
                        type="email"
                        placeholder="Recipient email *"
                        value={transferEmail}
                        onChange={(e) => setTransferEmail(e.target.value)}
                        className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Recipient name (optional)"
                        value={transferName}
                        onChange={(e) => setTransferName(e.target.value)}
                        className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none text-sm"
                      />
                    </div>
                    {transferError && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{transferError}</div>
                    )}
                    <button
                      onClick={() => handleTransfer(ticketId)}
                      disabled={transferring || !transferEmail.trim() || !ticketId}
                      className="mt-4 w-full py-2.5 bg-[var(--primary)] text-[var(--primary-ink)] font-medium rounded-lg hover:bg-[var(--primary-strong)] transition-colors disabled:opacity-50 text-sm"
                    >
                      {transferring ? 'Transferring...' : 'Transfer Ticket'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Get Ticket — prominent mobile app / QR panel */}
          <div id="get-ticket" className="lg:sticky lg:top-6 self-start scroll-mt-6">
            <div className="rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] p-1 shadow-xl">
              <div className="rounded-[14px] bg-[var(--surface)] p-1">
                <MobileTicketPanel
                  ticketId={ticketId}
                  holderName={t.holderName}
                  ticketTypeName={t.ticketTypeName}
                  ticketTypeColor={t.ticketTypeColor}
                  qr={['confirmed', 'transferred'].includes(status) ? <LiveQr ticketId={ticketId} /> : undefined}
                />
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-[var(--muted)]">
              QR codes rotate every 60 seconds for security — show this screen at the door.
            </p>
          </div>
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

  // --- Event Detail View ---
  if (selectedEvent) {
    const e = selectedEvent.data || selectedEvent;
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <button
          onClick={() => setSelectedEvent(null)}
          className="flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6"
        >
          <IconRenderer icon="ArrowLeft" className="w-4 h-4" />
          Back to events
        </button>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Event header image */}
          {(() => {
            const eventImg = getEventImageUrl(selectedEvent);
            return eventImg ? (
              <div className="h-48 bg-[var(--bg-2)]">
                <img src={eventImg} alt={e.title || e.name} className="w-full h-full object-cover" />
              </div>
            ) : null;
          })()}

          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text)]">{e.title || e.name}</h1>
                {e.type && <span className="text-sm text-[var(--muted)] capitalize">{e.type}</span>}
              </div>
              <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${statusColors[e.status] || 'bg-[var(--bg-2)] text-[var(--text-2)]'}`}>
                {formatStatus(e.status || 'upcoming')}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-3 text-sm">
                {(e.startDate || e.date) && (
                  <div className="flex items-center gap-2 text-[var(--text-2)]">
                    <IconRenderer icon="Calendar" className="w-4 h-4" />
                    <span>{formatDate(e.startDate || e.date)}</span>
                    {e.endDate && e.endDate !== e.startDate && <span>- {formatDate(e.endDate)}</span>}
                  </div>
                )}
                {(e.startTime || e.time) && (
                  <div className="flex items-center gap-2 text-[var(--text-2)]">
                    <IconRenderer icon="Clock" className="w-4 h-4" />
                    <span>{e.startTime || e.time}{e.endTime ? ` - ${e.endTime}` : ''}</span>
                  </div>
                )}
                {e.venue?.name && (
                  <div className="flex items-center gap-2 text-[var(--text-2)]">
                    <IconRenderer icon="MapPin" className="w-4 h-4" />
                    <span>{e.venue.name}{e.venue.city ? `, ${e.venue.city}` : ''}</span>
                  </div>
                )}
              </div>

              {/* Ticket types summary */}
              {e.ticketTypes && e.ticketTypes.length > 0 && (
                <div className="bg-[var(--bg-2)] rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-[var(--text)] mb-2">Tickets</h3>
                  <div className="space-y-2">
                    {e.ticketTypes.map((tt: any, idx: number) => {
                      const ttd = tt.data || tt;
                      return (
                        <div key={tt.sk || idx} className="flex justify-between text-sm">
                          <span className="text-[var(--text-2)]">{ttd.title || ttd.name}</span>
                          <span className="font-medium text-[var(--text)]">{formatCurrency(ttd.price, ttd.currency)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {e.description && (
              <div className="prose prose-sm max-w-none text-[var(--text-2)]" dangerouslySetInnerHTML={{ __html: e.description }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- List View ---
  const tabs = [
    { id: 'tickets' as const, label: 'My Tickets', count: tickets.length },
    { id: 'events' as const, label: 'Browse Events', count: events.length },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Events</h1>
        <p className="text-[var(--text-2)]">Your tickets and upcoming events</p>
      </div>

      {/* Search + Tabs */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <IconRenderer icon="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none text-sm"
          />
        </div>
        <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-[var(--primary)] text-[var(--primary-ink)]' : 'bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--bg-2)]'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* My Tickets */}
      {activeTab === 'tickets' && (
        <div>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-16">
              <IconRenderer icon="Ticket" className="w-12 h-12 text-[var(--faint)] mx-auto mb-3" />
              <p className="text-[var(--muted)] font-medium">No tickets yet</p>
              <p className="text-sm text-[var(--muted)] mt-1">Purchase tickets to upcoming events to see them here.</p>
              <button onClick={() => setActiveTab('events')} className="mt-4 text-sm text-[var(--primary)] hover:underline">
                Browse events
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket: any, idx: number) => {
                const t = ticket.data || ticket;
                const status = t.status || 'confirmed';
                return (
                  <button
                    key={ticket.sk || idx}
                    onClick={() => handleSelectTicket(ticket)}
                    className="w-full text-left bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 hover:shadow-md transition-shadow flex items-center gap-4"
                  >
                    {/* Color bar */}
                    <div
                      className="w-1.5 h-16 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.ticketTypeColor || '#6B7280' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-[var(--text)] truncate">{t.eventName || 'Event'}</h3>
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full flex-shrink-0 ${statusColors[status] || 'bg-[var(--bg-2)] text-[var(--text-2)]'}`}>
                          {formatStatus(status)}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted)] mt-0.5">{t.ticketTypeName || 'General'}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-[var(--muted)]">
                        {t.eventDate && <span>{formatDate(t.eventDate)}</span>}
                        {t.holderName && <span>{t.holderName}</span>}
                        {(ticket.sk || t.ticketId) && <span className="font-mono">{(ticket.sk || t.ticketId).slice(0, 10)}</span>}
                      </div>
                    </div>
                    <IconRenderer icon="ChevronRight" className="w-5 h-5 text-[var(--faint)] flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Browse Events */}
      {activeTab === 'events' && (
        <div>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-16">
              <IconRenderer icon="CalendarDays" className="w-12 h-12 text-[var(--faint)] mx-auto mb-3" />
              <p className="text-[var(--muted)] font-medium">No upcoming events</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((event: any, idx: number) => {
                const e = event.data || event;
                const img = getEventImageUrl(event);
                return (
                  <button
                    key={event.sk || idx}
                    onClick={() => setSelectedEvent(event)}
                    className="text-left bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="h-36 bg-[var(--bg-2)]">
                      {img ? (
                        <img src={img} alt={e.title || e.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <IconRenderer icon="Calendar" className="w-10 h-10 text-[var(--faint)]" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-[var(--text)] truncate">{e.title || e.name}</h3>
                      <div className="flex items-center gap-2 mt-2 text-xs text-[var(--muted)]">
                        {(e.startDate || e.date) && (
                          <>
                            <IconRenderer icon="Calendar" className="w-3.5 h-3.5" />
                            <span>{formatDate(e.startDate || e.date)}</span>
                          </>
                        )}
                      </div>
                      {e.venue?.name && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted)]">
                          <IconRenderer icon="MapPin" className="w-3.5 h-3.5" />
                          <span className="truncate">{e.venue.name}</span>
                        </div>
                      )}
                      {e.type && (
                        <span className="inline-block mt-2 text-xs px-2 py-0.5 bg-[var(--bg-2)] text-[var(--text-2)] rounded capitalize">{e.type}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Events;
