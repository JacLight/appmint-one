// from base-app/src/modules/reservation-system/booking-ui.tsx
'use client';

import React from 'react';
import { BOOKING_CSS } from './booking.css';

/**
 * The booking screens' shared pieces, drawn with the booking skin (`booking.css.ts`).
 * Every screen is markup over these; none of them carries booking logic.
 */

/** Whose booking page this is: the site's own name and logo (as on the invoice checkout). */
export type BookingBrand = { name?: string; logo?: string | null; label?: string };
export const BookingBrandContext = React.createContext<BookingBrand>({});

/** The site's name and logo, with what this page is on the right. */
function BrandBar() {
  const { name, logo, label } = React.useContext(BookingBrandContext);
  const [logoFailed, setLogoFailed] = React.useState(false);
  if (!name && !logo) return null;
  return (
    <header className="bk-topbar">
      <div className="bk-merchant">
        {logo && !logoFailed ? (
          <img className="bk-merchant-logo" src={logo} alt="" onError={() => setLogoFailed(true)} />
        ) : (
          <span className="bk-merchant-mark" aria-hidden>
            {(name || 'A').trim().charAt(0)}
          </span>
        )}
        {name}
      </div>
      {label && <span className="bk-topbar-label">{label}</span>}
    </header>
  );
}

/** The page: the skin, the site's bar, the eyebrow + title + subtitle, then the screen. One per page. */
export function BookingPage({ eyebrow, title, subtitle, children }: { eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bk-root">
      <style>{BOOKING_CSS}</style>
      <BrandBar />
      <div className="bk-wrap">
        {eyebrow && <p className="bk-eyebrow">{eyebrow}</p>}
        <h1 className="bk-title">{title}</h1>
        {subtitle && <p className="bk-sub">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export type StepItem = { id: string; label: string; done: boolean; current: boolean; onClick?: () => void };

/** Where the visitor is. A finished step can be clicked to go back to it. */
export function BookingSteps({ steps }: { steps: StepItem[] }) {
  if (steps.length < 2) return <div style={{ height: 24 }} />;
  return (
    <ol className="bk-steps" aria-label="Booking steps">
      {steps.map((s, i) => (
        <li key={s.id}>
          <button type="button" className={`bk-step${s.done ? ' bk-done' : ''}`} aria-current={s.current ? 'step' : undefined} disabled={!s.done || !s.onClick} onClick={s.onClick}>
            <span className="bk-step-num" aria-hidden>{s.done ? <Check size={12} /> : i + 1}</span>
            {s.label}
          </button>
        </li>
      ))}
    </ol>
  );
}

/** The step on the left, the summary (when there is one) on the right. */
export function BookingLayout({ summary, children }: { summary?: React.ReactNode; children: React.ReactNode }) {
  if (!summary) return <div className="bk-single">{children}</div>;
  return (
    <div className="bk-layout">
      <section className="bk-panel">{children}</section>
      <aside className="bk-summary" aria-label="Your reservation"><div className="bk-summary-inner">{summary}</div></aside>
    </div>
  );
}

/** A white card for a screen that stands alone (no summary). */
export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`bk-panel ${className}`}>{children}</section>;
}

/** A pickable row: icon or image, title, lines under it, and what sits at the end (price, arrow, tick). */
export function Choice({ selected, onClick, icon, image, title, lines, end, disabled }: { selected?: boolean; onClick: () => void; icon?: React.ReactNode; image?: string; title: React.ReactNode; lines?: React.ReactNode[]; end?: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="bk-choice" aria-pressed={!!selected} onClick={onClick} disabled={disabled}>
      {(image || icon) && <span className="bk-choice-icon" aria-hidden>{image ? <img src={image} alt="" /> : icon}</span>}
      <span className="bk-choice-copy">
        <strong>{title}</strong>
        {(lines || []).filter(Boolean).map((l, i) => (
          <span key={i} className="bk-small">{l}</span>
        ))}
      </span>
      <span className="bk-choice-end">{end ?? (selected ? <Check size={18} /> : <Arrow />)}</span>
    </button>
  );
}

export function Btn({ kind = 'primary', block, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'secondary' | 'danger'; block?: boolean }) {
  return (
    <button type="button" {...rest} className={`bk-btn bk-btn-${kind}${block ? ' bk-btn-block' : ''} ${rest.className || ''}`}>
      {children}
    </button>
  );
}

/** Back on the left, the way forward on the right. */
export function StepFooter({ back, backLabel = 'Back', next, nextLabel = 'Continue', nextDisabled, busy }: { back?: () => void; backLabel?: string; next?: () => void; nextLabel?: React.ReactNode; nextDisabled?: boolean; busy?: boolean }) {
  return (
    <div className="bk-footer">
      {back ? <button type="button" className="bk-link" onClick={back}>← {backLabel}</button> : <span />}
      {next && (
        <Btn onClick={next} disabled={nextDisabled || busy}>
          {busy && <span className="bk-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
          {nextLabel} {!busy && <Arrow />}
        </Btn>
      )}
    </div>
  );
}

export function Field({ label, optional, error, children }: { label: React.ReactNode; optional?: boolean; error?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="bk-field">
      <span>
        {label} {optional && <em>(optional)</em>}
      </span>
      {children}
      {error && <div className="bk-field-error">{error}</div>}
    </label>
  );
}

export function Policy({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bk-policy">
      <strong>{title}</strong>
      <br />
      {children}
    </div>
  );
}

/** What went wrong (error) or a note (info), where it happened; never a raw vendor message. */
export function Banner({ kind = 'error', children, onClose }: { kind?: 'error' | 'info'; children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className={`bk-banner bk-banner-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

/** A booking at a glance: what, its reference, then label/value rows. */
export function Ticket({ eyebrow, title, reference, rows }: { eyebrow?: React.ReactNode; title: React.ReactNode; reference?: React.ReactNode; rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <div className="bk-ticket">
      <div className="bk-ticket-head">
        {eyebrow && <p className="bk-eyebrow">{eyebrow}</p>}
        <h2 className="bk-h2" style={{ marginTop: 8 }}>{title}</h2>
        {reference && <span className="bk-small">{reference}</span>}
      </div>
      <div className="bk-ticket-body">
        {rows.filter(r => r[1] !== null && r[1] !== undefined && r[1] !== '').map((r, i) => (
          <div key={i} className="bk-row">
            <span>{r[0]}</span>
            <strong>{r[1]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Loading({ children = 'Loading…' }: { children?: React.ReactNode }) {
  return (
    <div className="bk-loading" role="status">
      <span className="bk-spinner" />
      {children}
    </div>
  );
}

export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Arrow({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** A small line icon for the choice tiles (calendar, pin, person, clock, card). */
export function Glyph({ name, size = 20 }: { name: 'calendar' | 'pin' | 'person' | 'clock' | 'card' | 'queue' | 'search'; size?: number }) {
  const d: Record<string, React.ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    card: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19" /></>,
    queue: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d[name]}
    </svg>
  );
}

export const money = (n?: number | null, currency = 'USD') => (typeof n === 'number' ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n) : '—');
export const minutes = (n?: number | null) => (n ? (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`) : '—');
