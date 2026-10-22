'use client';
// from base-app/src/components/events/EventList.tsx — logic kept; imports, engine wiring (server actions → src/api/events.ts) and theme tokens adapted.
import React, { useState, useEffect } from 'react';
import { eventsAPI as storefrontAPI } from './events-client';
import { IconRenderer } from './icon-renderer';
import { getEventImageUrl } from './event-image';

const formatDate = (d: string | undefined) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCurrency = (amount: number | undefined) => {
  if (amount == null || amount === 0) return 'Free';
  return `$${Number(amount).toFixed(2)}`;
};

interface EventListProps {
  events?: any[];
  slug?: string;
  onSelectEvent?: (event: any) => void;
  config?: any;
}

export const EventList: React.FC<EventListProps> = ({ events: initialEvents, slug, onSelectEvent, config }) => {
  const [events, setEvents] = useState<any[]>(initialEvents || []);
  const [loading, setLoading] = useState(!initialEvents);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialEvents) return;
    const load = async () => {
      setLoading(true);
      try {
        const result = await storefrontAPI.getEvents({ limit: config?.limit || 50 });
        setEvents(Array.isArray(result) ? result : []);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [initialEvents, config?.limit]);

  const filtered = events.filter((ev) => {
    if (!searchQuery) return true;
    const d = ev.data || ev;
    const q = searchQuery.toLowerCase();
    return (d.title || d.name || '').toLowerCase().includes(q) || (d.type || '').toLowerCase().includes(q) || (d.venue?.name || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-[var(--bg-2)] rounded-xl h-72" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-16">
        <IconRenderer icon="CalendarDays" className="w-12 h-12 text-[var(--faint)] mx-auto mb-3" />
        <p className="text-[var(--muted)] font-medium">No upcoming events</p>
      </div>
    );
  }

  const handleClick = (event: any) => {
    if (onSelectEvent) {
      onSelectEvent(event);
    } else if (slug) {
      const eventSlug = event.data?.slug || event.data?.name?.toLowerCase().replace(/\s+/g, '-') || event.sk;
      window.location.href = `/${slug}/${eventSlug}`;
    }
  };

  return (
    <div>
      {config?.showSearch !== false && (
        <div className="relative mb-6">
          <IconRenderer icon="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none text-sm"
          />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((event: any, idx: number) => {
          const e = event.data || event;
          const img = getEventImageUrl(event);
          const lowestPrice = e.ticketTypes?.reduce((min: number, tt: any) => {
            const p = (tt.data || tt).price;
            return p != null && p < min ? p : min;
          }, Infinity);

          return (
            <button
              key={event.sk || idx}
              onClick={() => handleClick(event)}
              className="text-left bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden hover:shadow-md transition-all group"
            >
              <div className="h-44 bg-[var(--bg-2)] overflow-hidden">
                {img ? (
                  <img src={img} alt={e.title || e.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--bg-2)] to-[var(--surface)]">
                    <IconRenderer icon="Calendar" className="w-12 h-12 text-[var(--faint)]" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text)] truncate">{e.title || e.name}</h3>
                {(e.startDate || e.date) && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-[var(--muted)]">
                    <IconRenderer icon="Calendar" className="w-3.5 h-3.5" />
                    <span>{formatDate(e.startDate || e.date)}</span>
                  </div>
                )}
                {e.venue?.name && (
                  <div className="flex items-center gap-2 mt-1 text-sm text-[var(--muted)]">
                    <IconRenderer icon="MapPin" className="w-3.5 h-3.5" />
                    <span className="truncate">{e.venue.name}{e.venue.city ? `, ${e.venue.city}` : ''}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  {e.type && <span className="text-xs px-2 py-0.5 bg-[var(--bg-2)] text-[var(--text-2)] rounded capitalize">{e.type}</span>}
                  {lowestPrice != null && lowestPrice !== Infinity && (
                    <span className="text-sm font-medium text-[var(--text)]">
                      {lowestPrice === 0 ? 'Free' : `From ${formatCurrency(lowestPrice)}`}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default EventList;
