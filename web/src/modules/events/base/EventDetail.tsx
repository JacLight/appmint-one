'use client';
// from base-app/src/components/events/EventDetail.tsx — logic kept; imports, engine wiring (server actions → src/api/events.ts) and theme tokens adapted.
import React, { useState, useEffect } from 'react';
import { eventsAPI as storefrontAPI } from './events-client';
import { IconRenderer } from './icon-renderer';
import { EventCheckout } from './EventCheckout';
import { getEventImageUrl, getEventImageUrls, getPersonImageUrl } from './event-image';
import { getResponseErrorMessage } from '@/lib-client/helpers';

const formatDate = (d: string | undefined) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatShortDate = (d: string | undefined) => {
  if (!d) return '';
  const dt = new Date(d);
  return {
    month: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: dt.getDate().toString(),
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
  };
};

// appmint-one: this engine stores event/session times as ISO date-times; show the clock time.
const hm = (s: string | undefined) => (s && /T\d/.test(s) ? new Date(s).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : s);

const formatCurrency = (amount: number | undefined) => {
  if (amount == null || amount === 0) return 'Free';
  return `$${Number(amount).toFixed(2)}`;
};

interface EventDetailProps {
  event?: any;
  eventId?: string;
  slug?: string;
  site?: any;
  config?: any;
  /** appmint-one: the signed-in customer, to prefill the buyer fields. */
  defaultEmail?: string;
  defaultName?: string;
}

export const EventDetail: React.FC<EventDetailProps> = ({ event: initialEvent, eventId, slug, site, defaultEmail, defaultName }) => {
  const [event, setEvent] = useState<any>(initialEvent || null);
  const [loading, setLoading] = useState(!initialEvent);
  // appmint-one: start from the server-rendered event's ticket types so buying never waits on the refetch.
  const [ticketTypes, setTicketTypes] = useState<any[]>(Array.isArray(initialEvent?.data?.ticketTypes) ? initialEvent.data.ticketTypes : []);

  // Purchase state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [buyerEmail, setBuyerEmail] = useState(defaultEmail || '');
  const [buyerName, setBuyerName] = useState(defaultName || '');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<any>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const evId = eventId || initialEvent?.sk || initialEvent?.id;

  useEffect(() => {
    if (!evId) return;
    const load = async () => {
      // Don't flash the skeleton if we already have something to show
      if (!initialEvent) setLoading(true);
      try {
        // Always hit the dedicated endpoint — the backend only attaches the
        // enriched child collections (participants, sessions, ticketTypes,
        // badgeTemplates, totalTickets) on the `enrich:true` findOneAnyId path
        // used by client/events/:id. When `initialEvent` comes from a list
        // query (e.g. page.requestData), those fields are absent and the UI
        // looked empty — even though the record was technically loaded.
        const detail = await storefrontAPI.getEventDetail(evId);
        const ev = detail?.event || detail || initialEvent;
        setEvent(ev);
        const inlineTTs = ev?.data?.ticketTypes || ev?.ticketTypes || (detail as any)?.ticketTypes;
        if (Array.isArray(inlineTTs)) {
          setTicketTypes(inlineTTs);
        }
      } catch (err: any) {
        // Leave whatever we already had in place; log so nothing is silent.
        console.error('EventDetail: failed to load enriched event', evId, getResponseErrorMessage(err));
        if (initialEvent) setEvent(initialEvent);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [evId, initialEvent]);

  const updateCart = (ttId: string, qty: number) => {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[ttId];
      else next[ttId] = qty;
      return next;
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalAmount = Object.entries(cart).reduce((sum, [ttId, qty]) => {
    const tt = ticketTypes.find((t) => (t.sk || t._id || t.id) === ttId);
    const price = (tt?.data || tt)?.price || 0;
    return sum + price * qty;
  }, 0);

  const handlePurchase = async () => {
    if (!buyerEmail.trim() || totalItems === 0) return;
    setPurchasing(true);
    setPurchaseError(null);
    try {
      const items = Object.entries(cart).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
      const result = await storefrontAPI.purchaseEventTickets({
        eventId: evId!,
        email: buyerEmail.trim(),
        name: buyerName.trim(),
        items,
      });
      setPurchaseResult(result);
      setCart({});
    } catch (err: any) {
      // Backend returns { error: { statusCode, error, path, ... } } — the nested
      // error.error is the actual human message (e.g. "Maximum 1 Free RSVP per
      // customer"). getResponseErrorMessage walks both axios and raw shapes.
      setPurchaseError(getResponseErrorMessage(err, 'Purchase failed. Please try again.'));
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 max-w-4xl mx-auto">
        <div className="h-64 bg-[var(--bg-2)] rounded-xl" />
        <div className="h-8 bg-[var(--border)] rounded w-2/3" />
        <div className="h-4 bg-[var(--border)] rounded w-1/3" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <IconRenderer icon="CalendarX" className="w-12 h-12 text-[var(--faint)] mx-auto mb-3" />
        <p className="text-[var(--muted)]">Event not found</p>
      </div>
    );
  }

  const e = event.data || event;
  const eventsPage = slug || 'events';

  // Purchase result — { booking, tickets }
  if (purchaseResult) {
    const bk = purchaseResult.booking?.data || purchaseResult.booking || {};
    const isPaid = bk.status === 'paid';
    const bookingId = purchaseResult.booking?.sk || bk.bookingRef || bk.referenceCode;

    // Free event — tickets issued immediately
    if (isPaid) {
      return (
        <div className="max-w-lg mx-auto text-center py-16 px-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <IconRenderer icon="Check" className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--text)] mb-2">Tickets Confirmed!</h2>
          <p className="text-[var(--text-2)] mb-4">
            Your {purchaseResult.tickets?.length || ''} ticket{(purchaseResult.tickets?.length || 0) > 1 ? 's have' : ' has'} been issued. Check your email for confirmation and QR codes.
          </p>
          {bookingId && (
            <a
              href={`/${eventsPage}/booking?bookingId=${encodeURIComponent(bookingId)}&email=${encodeURIComponent(buyerEmail)}`}
              className="inline-block px-6 py-3 bg-[var(--primary)] text-[var(--primary-ink)] font-medium rounded-lg hover:bg-[var(--primary-strong)] transition-colors"
            >
              View Your Tickets
            </a>
          )}
        </div>
      );
    }

    // Paid event — show Stripe checkout
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <a href={`/${eventsPage}`} className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6">
          <IconRenderer icon="ArrowLeft" className="w-4 h-4" />
          Back to events
        </a>
        <EventCheckout booking={purchaseResult.booking} tickets={purchaseResult.tickets} eventsPage={eventsPage} eventName={e.title || e.name} />
      </div>
    );
  }

  // Pull enriched collections from event.data (backend attaches these)
  const sessions: any[] = Array.isArray(e.sessions) ? e.sessions : [];
  const participants: any[] = Array.isArray(e.participants) ? e.participants : [];
  const heroImages = getEventImageUrls(event);
  const heroUrl = heroImages[0] || getEventImageUrl(event);
  const gallery = heroImages.slice(1);

  // Group participants by type: speaker, sponsor, exhibitor, vip, press, volunteer
  const participantGroups: Record<string, any[]> = {};
  for (const p of participants) {
    const pd = p.data || p;
    const key = (pd.type || 'participant').toLowerCase();
    (participantGroups[key] = participantGroups[key] || []).push(p);
  }
  const typePriority = (k: string) =>
    ({ speaker: 0, keynote: 0, sponsor: 1, exhibitor: 2, vip: 3, press: 4, volunteer: 5, attendee: 9 }[k] ?? 6);
  const orderedParticipantKeys = Object.keys(participantGroups).sort((a, b) => typePriority(a) - typePriority(b));
  const labelForType = (k: string) => {
    const pluralized = k.endsWith('s') ? k : `${k}s`;
    return pluralized.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Sessions grouped by day
  const sessionsByDay: Record<string, any[]> = {};
  for (const s of sessions) {
    const sd = s.data || s;
    const day = (sd.startDate || sd.date || sd.day || 'TBA').toString().slice(0, 10);
    (sessionsByDay[day] = sessionsByDay[day] || []).push(s);
  }
  const dayKeys = Object.keys(sessionsByDay).sort();

  const startDateShort = formatShortDate(e.startDate || e.date);

  // ──────────────────────────────────────────────────────────────
  // Ticket sidebar (reused at top on mobile + sticky on desktop)
  // ──────────────────────────────────────────────────────────────
  const TicketsPanel = (
    <div className="bg-[var(--surface)] rounded-2xl shadow-lg border border-[var(--border)] overflow-hidden">
      <div className="px-5 py-4 bg-[var(--primary)] text-[var(--primary-ink)]">
        <p className="text-[11px] uppercase tracking-widest opacity-70">Get Tickets</p>
        <p className="text-lg font-semibold">
          {ticketTypes.length === 0
            ? 'No tickets available'
            : ticketTypes.length === 1
              ? formatCurrency((ticketTypes[0]?.data || ticketTypes[0])?.price)
              : `From ${formatCurrency(Math.min(...ticketTypes.map((tt: any) => (tt.data || tt)?.price || 0)))}`}
        </p>
      </div>

      {ticketTypes.length === 0 ? (
        <div className="p-5 text-sm text-[var(--muted)] text-center">Check back soon.</div>
      ) : (
        <div className="p-5 space-y-3">
          {ticketTypes.map((tt: any, idx: number) => {
            const ttd = tt.data || tt;
            const ttId = tt.sk || tt._id || tt.id || `tt-${idx}`;
            const qty = cart[ttId] || 0;
            const soldOut = ttd.capacity && ttd.sold >= ttd.capacity;
            return (
              <div key={ttId} className="border border-[var(--border)] rounded-lg p-3">
                {/* Top row: name (full width) */}
                <div className="flex items-center gap-2 min-w-0">
                  {ttd.color && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ttd.color }} />}
                  <h4 className="font-semibold text-sm text-[var(--text)] truncate min-w-0">{ttd.title || ttd.name}</h4>
                </div>
                {ttd.description && <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{ttd.description}</p>}

                {/* Bottom row: price on the left, stepper on the right — own line so they can't clash with the name */}
                <div className="flex items-center justify-between gap-3 mt-2.5">
                  <p className="text-sm font-bold text-[var(--text)]">{formatCurrency(ttd.price)}</p>
                  {soldOut ? (
                    <span className="text-xs text-red-500 font-medium whitespace-nowrap">Sold Out</span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCart(ttId, qty - 1)}
                        disabled={qty <= 0}
                        className="w-7 h-7 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--bg-2)] disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-medium">{qty}</span>
                      <button
                        type="button"
                        onClick={() => updateCart(ttId, qty + 1)}
                        className="w-7 h-7 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--text-2)] hover:bg-[var(--bg-2)]"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {totalItems > 0 && (
            <div className="pt-3 border-t border-[var(--border)] space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--text-2)]">{totalItems} ticket{totalItems > 1 ? 's' : ''}</span>
                <span className="font-bold text-[var(--text)]">{formatCurrency(totalAmount)}</span>
              </div>
              <input
                type="email"
                required
                placeholder="Email address *"
                value={buyerEmail}
                onChange={(ev) => setBuyerEmail(ev.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none text-sm"
              />
              <input
                type="text"
                placeholder="Full name"
                value={buyerName}
                onChange={(ev) => setBuyerName(ev.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none text-sm"
              />
              {purchaseError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{purchaseError}</div>
              )}
              <button
                type="button"
                onClick={handlePurchase}
                disabled={purchasing || !buyerEmail.trim()}
                className="w-full py-3 bg-[var(--primary)] text-[var(--primary-ink)] font-semibold rounded-lg hover:bg-[var(--primary-strong)] transition-colors disabled:opacity-50 text-sm"
              >
                {purchasing ? 'Processing...' : totalAmount === 0 ? 'Register (Free)' : `Pay ${formatCurrency(totalAmount)}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Back link */}
      <a href={`/${eventsPage}`} className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--text)] mb-6">
        <IconRenderer icon="ArrowLeft" className="w-4 h-4" />
        Back to events
      </a>

      {/* Hero with overlay */}
      {heroUrl ? (
        <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-8">
          <img src={heroUrl} alt={e.title || e.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
            <div className="flex items-end gap-4">
              {startDateShort && (
                <div className="bg-white/95 text-[#111] rounded-lg overflow-hidden shadow-lg flex-shrink-0">
                  <div className="bg-red-600 text-white text-[10px] font-bold text-center py-1 px-3">{startDateShort.month}</div>
                  <div className="text-2xl md:text-3xl font-bold text-center px-3 py-1">{startDateShort.day}</div>
                </div>
              )}
              <div className="min-w-0 flex-1">
                {e.type && <span className="inline-block text-[10px] font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded mb-2">{e.type}</span>}
                <h1 className="text-2xl md:text-4xl font-bold leading-tight drop-shadow">{e.title || e.name}</h1>
                {e.venue?.name && (
                  <p className="text-sm md:text-base opacity-90 mt-1 flex items-center gap-1.5">
                    <IconRenderer icon="MapPin" className="w-4 h-4" />
                    {e.venue.name}{e.venue.city ? `, ${e.venue.city}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--text)] mb-2">{e.title || e.name}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
            {(e.startDate || e.date) && <span className="flex items-center gap-1.5"><IconRenderer icon="Calendar" className="w-4 h-4" />{formatDate(e.startDate || e.date)}</span>}
            {e.venue?.name && <span className="flex items-center gap-1.5"><IconRenderer icon="MapPin" className="w-4 h-4" />{e.venue.name}</span>}
          </div>
        </div>
      )}

      {/* Two-column layout: content + sticky ticket panel */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        {/* Main column */}
        <div className="space-y-8 min-w-0">
          {/* Quick meta row */}
          <div className="flex flex-wrap gap-6 text-sm border-y border-[var(--border)] py-4">
            {(e.startDate || e.date) && (
              <div className="flex items-center gap-2">
                <IconRenderer icon="Calendar" className="w-5 h-5 text-[var(--muted)]" />
                <div>
                  <p className="font-semibold text-[var(--text)]">{formatDate(e.startDate || e.date)}</p>
                  {e.endDate && e.endDate !== (e.startDate || e.date) && <p className="text-xs text-[var(--muted)]">to {formatDate(e.endDate)}</p>}
                </div>
              </div>
            )}
            {(e.startTime || e.time) && (
              <div className="flex items-center gap-2">
                <IconRenderer icon="Clock" className="w-5 h-5 text-[var(--muted)]" />
                <div>
                  <p className="font-semibold text-[var(--text)]">{hm(e.startTime || e.time)}{e.endTime ? ` – ${hm(e.endTime)}` : ''}</p>
                </div>
              </div>
            )}
            {e.venue?.name && (
              <div className="flex items-center gap-2">
                <IconRenderer icon="MapPin" className="w-5 h-5 text-[var(--muted)]" />
                <div>
                  <p className="font-semibold text-[var(--text)]">{e.venue.name}</p>
                  {(e.venue.city || e.venue.address) && <p className="text-xs text-[var(--muted)]">{[e.venue.address, e.venue.city].filter(Boolean).join(', ')}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Mobile-only: ticket panel appears here so it stays above the fold */}
          <div className="lg:hidden">{TicketsPanel}</div>

          {/* About */}
          {(e.description || e.shortDescription) && (
            <section>
              <h2 className="text-xl font-bold text-[var(--text)] mb-3">About this event</h2>
              {e.shortDescription && <div className="prose prose-sm max-w-none text-[var(--text-2)] mb-3" dangerouslySetInnerHTML={{ __html: e.shortDescription }} />}
              {e.description && (
                <div className="prose prose-sm max-w-none text-[var(--text-2)]" dangerouslySetInnerHTML={{ __html: e.description }} />
              )}
            </section>
          )}

          {/* Participants, grouped by type (Speakers / Sponsors / Exhibitors / ...) */}
          {orderedParticipantKeys.map((key) => (
            <section key={key}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-[var(--text)]">{labelForType(key)}</h2>
                <span className="text-sm text-[var(--muted)]">{participantGroups[key].length}</span>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {participantGroups[key].map((part: any, idx: number) => {
                  const p = part.data || part;
                  const personImg = getPersonImageUrl(part);
                  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.name || p.email || 'Guest';
                  return (
                    <div
                      key={part.sk || idx}
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 text-center hover:shadow-md transition-shadow"
                    >
                      <div className="w-20 h-20 rounded-full bg-[var(--bg-2)] overflow-hidden flex items-center justify-center mx-auto mb-3">
                        {personImg ? (
                          <img src={personImg} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          <IconRenderer icon="User" className="w-8 h-8 text-[var(--muted)]" />
                        )}
                      </div>
                      <div className="flex items-center justify-center gap-1.5">
                        <p className="font-semibold text-[var(--text)] truncate">{name}</p>
                        {p.featured && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold flex-shrink-0">★</span>
                        )}
                      </div>
                      {p.role && <p className="text-xs text-[var(--muted)] capitalize mt-0.5">{p.role}</p>}
                      {p.shortBio && <p className="text-xs text-[var(--text-2)] mt-2 line-clamp-3">{p.shortBio}</p>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Schedule */}
          {sessions.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-[var(--text)] mb-4">Schedule</h2>
              <div className="space-y-6">
                {dayKeys.map((day) => (
                  <div key={day}>
                    {day !== 'TBA' && (
                      <h3 className="text-sm font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">
                        {formatDate(day)}
                      </h3>
                    )}
                    <div className="space-y-2">
                      {sessionsByDay[day].map((session: any, idx: number) => {
                        const s = session.data || session;
                        return (
                          <div key={session.sk || idx} className="flex gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:border-[var(--text-2)] transition">
                            <div className="text-sm text-[var(--muted)] w-24 flex-shrink-0">
                              {s.startTime && <p className="font-semibold text-[var(--text)]">{hm(s.startTime)}</p>}
                              {s.endTime && <p className="text-xs">to {hm(s.endTime)}</p>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-[var(--text)]">{s.name || s.title}</h4>
                              {s.description && <p className="text-sm text-[var(--muted)] mt-1 line-clamp-2">{s.description}</p>}
                              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--muted)]">
                                {s.track && <span className="px-2 py-0.5 bg-[var(--bg-2)] rounded">{s.track}</span>}
                                {s.room && <span className="flex items-center gap-1"><IconRenderer icon="MapPin" className="w-3 h-3" />{s.room}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Venue detail */}
          {e.venue && (e.venue.address || e.venue.city) && (
            <section>
              <h2 className="text-xl font-bold text-[var(--text)] mb-3">Venue</h2>
              <div className="bg-[var(--bg-2)] rounded-lg p-5">
                <p className="font-semibold text-[var(--text)]">{e.venue.name}</p>
                {e.venue.address && (
                  <p className="text-sm text-[var(--text-2)] mt-1">
                    {[e.venue.address, e.venue.city, e.venue.state, e.venue.country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Gallery */}
          {gallery.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-[var(--text)] mb-4">Gallery</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {gallery.map((url, i) => (
                  <div key={i} className="aspect-video rounded-lg overflow-hidden bg-[var(--bg-2)]">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Desktop-only: sticky ticket sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-6">{TicketsPanel}</div>
        </aside>
      </div>
    </div>
  );
};

export default EventDetail;
