'use client';
// from base-app/src/components/events/MobileTicketPanel.tsx — logic kept; imports, engine wiring (server actions → src/api/events.ts) and theme tokens adapted.
import React from 'react';
import { IconRenderer } from './icon-renderer';

interface MobileTicketPanelProps {
  ticketId?: string;
  holderName?: string;
  ticketTypeName?: string;
  ticketTypeColor?: string;
  // Optional store links — can be threaded from site config later.
  iosAppUrl?: string;
  androidAppUrl?: string;
  /** appmint-one: the live door QR. When given it replaces the "open the app" message
   *  (Jacob: the web shows the QR to scan at the door). */
  qr?: React.ReactNode;
}

/**
 * Panel shown in place of a QR code on the web.
 *
 * Rationale: QR codes for event entry rotate every 60 seconds (see
 * appengine/src/events/CLIENT_API_GUIDE.md — ticket.data.code). Displaying them
 * on the web creates two problems:
 *   1. Users might screenshot a stale code and get rejected at the gate.
 *   2. The rotating code is the security mechanism; showing it in a desktop
 *      browser undermines the "device possession" assumption.
 *
 * Policy decision: QR is mobile-app only. On the web we show this panel
 * telling the user to open the Event App. The ticket ID is still shown as
 * monospace text so staff can manually verify if needed.
 */
export const MobileTicketPanel: React.FC<MobileTicketPanelProps> = ({
  ticketId,
  holderName,
  ticketTypeName,
  ticketTypeColor,
  iosAppUrl,
  androidAppUrl,
  qr,
}) => {
  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 text-center">
      {/* Header bar (color-coded by ticket type) */}
      {ticketTypeColor && (
        <div className="h-1.5 -mx-6 -mt-6 mb-6 rounded-t-xl" style={{ backgroundColor: ticketTypeColor }} />
      )}

      {qr ? qr : (
        <>
      <div className="w-16 h-16 rounded-full bg-[var(--primary)] flex items-center justify-center mx-auto mb-4">
        <IconRenderer icon="Smartphone" className="w-8 h-8 text-white" />
      </div>

      <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Open the Event App</h3>
      <p className="text-sm text-[var(--muted)] max-w-sm mx-auto mb-5">
        Your ticket QR code lives in the mobile app. It refreshes every 60 seconds for security,
        so you'll need to show it from your phone at the entrance.
      </p>

        </>
      )}

      {/* App store badges */}
      {(iosAppUrl || androidAppUrl) && (
        <div className="flex items-center justify-center gap-3 mb-5">
          {iosAppUrl && (
            <a
              href={iosAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-ink)] rounded-lg text-sm font-medium hover:bg-[var(--primary-strong)] transition-colors"
            >
              <IconRenderer icon="Apple" className="w-4 h-4" />
              App Store
            </a>
          )}
          {androidAppUrl && (
            <a
              href={androidAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-ink)] rounded-lg text-sm font-medium hover:bg-[var(--primary-strong)] transition-colors"
            >
              <IconRenderer icon="Play" className="w-4 h-4" />
              Google Play
            </a>
          )}
        </div>
      )}

      {/* Ticket reference — fallback for manual verification */}
      <div className="border-t border-[var(--border)] pt-4 text-left space-y-2">
        {ticketTypeName && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Ticket</span>
            <span className="font-medium text-[var(--text)]">{ticketTypeName}</span>
          </div>
        )}
        {holderName && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Holder</span>
            <span className="font-medium text-[var(--text)]">{holderName}</span>
          </div>
        )}
        {ticketId && (
          <div className="flex justify-between text-sm">
            <span className="text-[var(--muted)]">Reference</span>
            <span className="font-mono text-xs text-[var(--text)] break-all">{ticketId}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileTicketPanel;
