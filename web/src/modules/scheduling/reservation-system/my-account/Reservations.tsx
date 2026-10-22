// from base-app/src/components/my-account/Reservations.tsx (imports adapted; the slide panel and icons from ./slide-panel and ./icon)
'use client';
import React, { useState } from 'react';
import { IconRenderer } from '../icon';
import { SlidePanel } from './slide-panel';
type MyAccountData = { reservations?: any[] };
import { reservationDisplay, matchesReservation } from './reservation-display';
import { BOOKING_CSS } from '../booking.css';
import { Banner, Btn, Field, Policy, Ticket } from '../booking-ui';
import ChangeBooking from '../change-booking';
import { getReservationAPI } from '../api';

interface ReservationsProps {
  data: MyAccountData;
  /** appmint-one: the setup's words for the page. */
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export const Reservations: React.FC<ReservationsProps> = ({ data, title = 'Reservations', subtitle = 'View and manage your reservations', headerAction }) => {
  // A change or cancel made here is kept over the loaded list until the page is read again.
  const [edits, setEdits] = useState<Record<string, any>>({});
  const reservations = (data?.reservations || []).map((r: any) => edits[r.sk] || r);

  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [action, setAction] = useState<'change' | 'cancel' | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [done, setDone] = useState('');
  const keep = (record: any) => {
    setEdits((e) => ({ ...e, [record.sk]: record }));
    setSelectedReservation(record);
  };
  const openReservation = (reservation: any) => {
    setAction(null);
    setActionError('');
    setDone('');
    setCancelReason('');
    setSelectedReservation(reservation);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredReservations = reservations.filter((reservation: any) => matchesReservation(reservation, searchQuery, filterStatus));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
      case 'confirmed':
        return 'bk-pill';
      case 'completed':
        return 'bk-pill bk-pill-muted';
      case 'cancelled':
        return 'bk-pill bk-pill-danger';
      default:
        return 'bk-pill bk-pill-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'Clock';
      case 'confirmed':
        return 'CheckCircle';
      case 'completed':
        return 'Check';
      case 'cancelled':
        return 'X';
      default:
        return 'Calendar';
    }
  };

  const ReservationDetails = () => {
    if (!selectedReservation) return null;

    const resData = selectedReservation.data || selectedReservation;
    const display = reservationDisplay(selectedReservation);
    // Still ahead and not closed off: the same statuses the Overview counts as upcoming.
    const canAct =
      ['new', 'upcoming', 'confirmed', 'pending'].includes(display.status) &&
      !!display.reference &&
      !(resData?.startTime && new Date(resData.startTime) <= new Date());
    const bookedEmail = resData?.customer?.email || resData?.email || resData?.contactEmail || selectedReservation?.author || '';

    const locationText = resData?.location
      ? typeof resData.location === 'string'
        ? resData.location
        : [
            resData.location.address,
            resData.location.city && resData.location.state
              ? `${resData.location.city}, ${resData.location.state} ${resData.location.zip || resData.location.postalCode || ''}`.trim()
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
      : '';

    return (
      <SlidePanel
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        title={display.service}
      >
        <div className="p-6">
          <Ticket
            eyebrow={
              <span className={getStatusColor(display.status)}>
                <IconRenderer icon={getStatusIcon(display.status)} className="w-3.5 h-3.5" />
                {display.status}
              </span>
            }
            title={display.service}
            reference={display.reference ? <>Confirmation <span className="bk-mono">{display.reference}</span></> : undefined}
            rows={[
              ['Service', display.service],
              ['Type', resData?.serviceType ? <span style={{ textTransform: 'capitalize' }}>{resData.serviceType}</span> : null],
              ['When', display.date],
              ['Time', display.time ? `${display.time} · ${display.timezone}` : null],
              ['Duration', resData?.duration || null],
              ['Where', locationText || null],
            ]}
          />

          {/* Notes */}
          {resData?.notes && (
            <div className="bk-policy" style={{ marginTop: 0 }}>
              <strong>Notes</strong>
              <p style={{ whiteSpace: 'pre-wrap' }}>{resData.notes}</p>
            </div>
          )}

          {/* Contact Info */}
          {(resData?.contactName || resData?.contactEmail || resData?.contactPhone) && (
            <div className="bk-card" style={{ marginTop: 16 }}>
              <h3 className="bk-h3">Contact information</h3>
              {resData.contactName && (
                <p className="bk-small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconRenderer icon="User" className="w-4 h-4" />
                  {resData.contactName}
                </p>
              )}
              {resData.contactEmail && (
                <p className="bk-small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconRenderer icon="Mail" className="w-4 h-4" />
                  {resData.contactEmail}
                </p>
              )}
              {resData.contactPhone && (
                <p className="bk-small" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconRenderer icon="Phone" className="w-4 h-4" />
                  {resData.contactPhone}
                </p>
              )}
            </div>
          )}

          {done && (
            <div style={{ marginTop: 22 }}>
              <Banner kind="info" onClose={() => setDone('')}>{done}</Banner>
            </div>
          )}

          {/* Actions: a booking still ahead can move or be cancelled (found by its email and code, like the public manage page). */}
          {canAct && !action && (
            <div className="bk-actions" style={{ marginTop: 22 }}>
              <Btn kind="secondary" onClick={() => { setDone(''); setAction('change'); }}>Reschedule</Btn>
              <Btn kind="danger" onClick={() => { setDone(''); setActionError(''); setAction('cancel'); }}>Cancel Reservation</Btn>
            </div>
          )}

          {canAct && action === 'change' && (
            <div style={{ marginTop: 22 }}>
              <ChangeBooking
                reservation={selectedReservation}
                email={bookedEmail}
                code={display.reference}
                onClose={() => setAction(null)}
                onChanged={(startTime) => {
                  const start = new Date(startTime);
                  const length = new Date(resData.endTime).getTime() - new Date(resData.startTime).getTime();
                  const end = length > 0 ? new Date(start.getTime() + length).toISOString() : resData.endTime;
                  keep({ ...selectedReservation, data: { ...resData, startTime, endTime: end } });
                  setAction(null);
                  setDone(`Moved to ${start.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. We've emailed you the new time.`);
                }}
              />
            </div>
          )}

          {canAct && action === 'cancel' && (
            <div className="bk-card" role="group" aria-label="Confirm cancellation" style={{ marginTop: 22, borderColor: 'var(--bk-danger)' }}>
              <h3 className="bk-h3">Cancel this booking?</h3>
              <p className="bk-small">
                {display.service}
                {display.date ? ` · ${display.date}` : ''}
                {display.time ? ` at ${display.time}` : ''}. This cannot be undone.
              </p>
              <Policy title="Cancellation policy">
                You may cancel or reschedule your appointment up to 24 hours before your scheduled time without any charges. Late cancellations or no-shows may be
                subject to a fee.
              </Policy>
              <Field label="Reason" optional>
                <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Let us know why you're cancelling." />
              </Field>
              {actionError && (
                <div style={{ marginTop: 16 }}>
                  <Banner onClose={() => setActionError('')}>{actionError}</Banner>
                </div>
              )}
              <div className="bk-actions" style={{ marginTop: 18 }}>
                <Btn
                  kind="danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setActionError('');
                    try {
                      await getReservationAPI().cancelReservation(bookedEmail, display.reference, cancelReason.trim() || undefined);
                      keep({ ...selectedReservation, data: { ...resData, status: 'cancelled' } });
                      setAction(null);
                      setDone('Your booking is cancelled. We’ve emailed you a confirmation.');
                    } catch (e: any) {
                      const msg = e?.response?.data?.message;
                      setActionError(typeof msg === 'string' && msg ? msg : 'The booking could not be cancelled. Try again.');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy && <span className="bk-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
                  {busy ? 'Cancelling…' : 'Yes, cancel booking'}
                </Btn>
                <Btn kind="secondary" disabled={busy} onClick={() => setAction(null)}>Keep my booking</Btn>
              </div>
            </div>
          )}
        </div>
      </SlidePanel>
    );
  };

  return (
    <div className="bk-root" style={{ background: 'transparent', padding: 0, minHeight: 0 }}>
      <style>{BOOKING_CSS}</style>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <p className="bk-eyebrow">My account</p>
          <h1 className="bk-title" style={{ fontSize: 32 }}>{title}</h1>
          <p className="bk-sub">{subtitle}</p>
          {headerAction}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <IconRenderer icon="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" color="var(--bk-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reservations..."
              aria-label="Search reservations"
              className="bk-input"
              style={{ paddingLeft: 40 }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
            className="bk-input"
            style={{ width: 'auto' }}
          >
            <option value="all">All Reservations</option>
            <option value="upcoming">Upcoming</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Reservations List */}
        {filteredReservations?.length > 0 ? (
          <div className="bk-list">
            {filteredReservations.map((reservation: any) => {
              const resData = reservation.data || reservation;
              const display = reservationDisplay(reservation);
              const resId = reservation.sk || reservation.id || reservation._id;

              return (
                <div
                  key={resId}
                  onClick={() => openReservation(reservation)}
                  className="bk-card bk-choice"
                  style={{ display: 'block', padding: 20, cursor: 'pointer' }}
                >
                  <div className="bk-row" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 className="bk-h3" style={{ fontSize: 17 }}>{display.service}</h3>
                      <span className="bk-small">{resData?.serviceType || resData?.type || ''}</span>
                    </div>
                    <span className={getStatusColor(display.status)}>
                      <IconRenderer icon={getStatusIcon(display.status)} className="w-3.5 h-3.5" />
                      {display.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 bk-small">
                    <span className="flex items-center">
                      <IconRenderer icon="Calendar" className="w-4 h-4 mr-2" />
                      {display.date}
                    </span>
                    {display.time && (
                      <span className="flex items-center">
                        <IconRenderer icon="Clock" className="w-4 h-4 mr-2" />
                        {display.time} · {display.timezone}
                      </span>
                    )}
                    {resData?.location && (
                      <span className="flex items-center">
                        <IconRenderer icon="MapPin" className="w-4 h-4 mr-2" />
                        <span className="truncate max-w-xs">
                          {typeof resData.location === 'string' ? resData.location : resData.location.city || resData.location.address || 'Location'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bk-card" style={{ textAlign: 'center', padding: '48px 18px' }}>
            <span style={{ color: 'var(--bk-muted)', display: 'inline-flex' }}>
              <IconRenderer icon="Calendar" className="w-12 h-12 mx-auto mb-4" />
            </span>
            <h3 className="bk-h3">No Reservations Found</h3>
            <p className="bk-small">
              {searchQuery || filterStatus !== 'all' ? 'No reservations match your search criteria.' : "You haven't made any reservations yet."}
            </p>
          </div>
        )}

        {/* Reservation Details Panel */}
        {selectedReservation && ReservationDetails()}
      </div>
    </div>
  );
};
