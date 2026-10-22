// from base-app/src/modules/reservation-system/change-booking.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { addDays, format, parseISO } from 'date-fns';
import { getReservationAPI } from './api';
import { Banner, Btn, Field, Loading } from './booking-ui';

const api = getReservationAPI();
const WEEK = 7;

const serverMessage = (error: any, fallback: string) => {
  const data = error?.response?.data;
  const msg = data?.message ?? data?.error;
  return typeof msg === 'string' && msg ? msg : fallback;
};

/**
 * Change a booking's time: a week of days (open times counted by the server, with this
 * booking's own seat free), the day's times, then the move. The server checks the time again
 * and answers with what stands in the way when it cannot take it.
 */
export default function ChangeBooking({
  reservation,
  email,
  code,
  onChanged,
  onClose,
}: {
  /** The booking as the server sent it (sk + data). */
  reservation: any;
  email: string;
  code: string;
  onChanged: (startTime: string) => void;
  onClose: () => void;
}) {
  const data = reservation?.data || {};
  const reservationId = reservation?.sk || reservation?.id;
  const definitionId = data.reservationDefinitionId || reservation?.owner?.id;
  const host = Array.isArray(data.hosts) ? data.hosts[0] : data.hosts || undefined;

  const [from, setFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [week, setWeek] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError('');
    setSlot(null);
    api
      .getAvailability({ reservationDefinitionId: definitionId, serviceName: data.service, from, days: WEEK, host, excludeReservationId: reservationId })
      .then((res) => {
        if (!live) return;
        setWeek(res);
        // Open on the first day with a free time.
        const firstOpen = (res?.days || []).find((d: any) => d.openSlots > 0);
        setDay(firstOpen?.date || res?.days?.[0]?.date || null);
      })
      .catch((e) => live && setLoadError(serverMessage(e, 'The open times could not be loaded. Try again.')))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [from, definitionId, reservationId]);

  const tz = week?.timezone;
  const timeLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) });
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', ...(tz ? { timeZone: tz } : {}) });
  const today = format(new Date(), 'yyyy-MM-dd');
  const days: any[] = week?.days || [];
  const selectedDay = days.find((d) => d.date === day);
  const current = data.startTime ? `${dayLabel(data.startTime)} at ${timeLabel(data.startTime)}` : '';

  const save = async () => {
    if (!slot) return;
    setSaving(true);
    setError('');
    try {
      await api.rescheduleReservationByEmail(email, code, { startTime: slot.startTime, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      onChanged(slot.startTime);
    } catch (e: any) {
      setError(serverMessage(e, 'The booking could not be moved. Try another time.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-card" role="group" aria-label="Change booking time" style={{ borderColor: 'var(--bk-accent)' }}>
      <h3 className="bk-h3">Pick a new time</h3>
      <p className="bk-small">
        {current ? <>Now booked for {current}. </> : null}
        {tz ? `Times are in ${tz}.` : null}
      </p>

      <div className="bk-cal-head" style={{ marginTop: 16 }}>
        <strong>{days.length ? `${format(parseISO(days[0].date), 'MMM d')} – ${format(parseISO(days[days.length - 1].date), 'MMM d, yyyy')}` : ' '}</strong>
        <div className="bk-cal-nav">
          <button type="button" aria-label="Previous week" disabled={loading || from <= today} onClick={() => setFrom(format(addDays(parseISO(from), -WEEK), 'yyyy-MM-dd'))}>
            ‹
          </button>
          <button type="button" aria-label="Next week" disabled={loading} onClick={() => setFrom(format(addDays(parseISO(from), WEEK), 'yyyy-MM-dd'))}>
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <Loading>Finding open times…</Loading>
      ) : loadError ? (
        <div style={{ marginTop: 14 }}>
          <Banner>{loadError}</Banner>
        </div>
      ) : (
        <>
          <div className="bk-slots" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(84px,1fr))' }}>
            {days.map((d) => (
              <button
                key={d.date}
                type="button"
                className="bk-slot"
                aria-pressed={d.date === day}
                disabled={d.closed || !d.openSlots}
                onClick={() => {
                  setDay(d.date);
                  setSlot(null);
                }}
                style={{ textDecoration: 'none', lineHeight: 1.3 }}
              >
                <strong style={{ display: 'block' }}>{format(parseISO(d.date), 'EEE d')}</strong>
                <span style={{ fontSize: 11 }}>{d.closed ? 'Closed' : d.hostOnLeave ? 'Away' : d.openSlots ? `${d.openSlots} open` : 'Full'}</span>
              </button>
            ))}
          </div>

          {selectedDay && (
            <>
              <p className="bk-small" style={{ marginTop: 18 }}>{format(parseISO(selectedDay.date), 'EEEE, MMMM d')}</p>
              {selectedDay.slots?.some((s: any) => s.spotsAvailable > 0) ? (
                <div className="bk-slots">
                  {selectedDay.slots.map((s: any) => (
                    <button
                      key={s.startTime}
                      type="button"
                      className="bk-slot"
                      aria-pressed={slot?.startTime === s.startTime}
                      disabled={!(s.spotsAvailable > 0) || s.startTime === data.startTime || new Date(s.startTime) <= new Date()}
                      onClick={() => setSlot(s)}
                    >
                      {timeLabel(s.startTime)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="bk-small">No open times this day. Pick another day.</p>
              )}
            </>
          )}
        </>
      )}

      <Field label="Reason" optional>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Let us know why you're changing it." />
      </Field>

      {error && (
        <div style={{ marginTop: 16 }}>
          <Banner onClose={() => setError('')}>{error}</Banner>
        </div>
      )}

      <div className="bk-actions" style={{ marginTop: 18 }}>
        <Btn disabled={!slot || saving} onClick={save}>
          {saving && <span className="bk-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
          {saving ? 'Moving…' : slot ? `Move to ${dayLabel(slot.startTime)}, ${timeLabel(slot.startTime)}` : 'Pick a time'}
        </Btn>
        <Btn kind="secondary" disabled={saving} onClick={onClose}>
          Keep the current time
        </Btn>
      </div>
    </div>
  );
}
