import Link from "next/link";
import type { Contact } from "@/api/rentals";
import { routes } from "@/lib/nav";
import { fmtDate } from "@/lib/dates";

function initials(name?: string): string {
  return (name || "?").split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** A booking-counterparty profile card — the host (guest's view) or the guest
 *  (host's view). Like the driver/rider card in a rideshare app: who they are,
 *  plus real ways to reach them (message, call, email). */
export function ContactCard({ role, person, subtitle }: { role: "Host" | "Guest"; person: Contact; subtitle?: string }) {
  const messageHref = `${routes.account}/messages/${encodeURIComponent(person.email || person.id)}`;
  const since = fmtDate(person.memberSince ?? undefined);
  return (
    <div className="tcard cc">
      <div className="cc-eyebrow">Your {role.toLowerCase()}</div>
      <div className="cc-head">
        {person.avatar
          ? <img className="cc-av" src={person.avatar} alt={person.name} />
          : <div className="cc-av cc-av-ph" aria-hidden>{initials(person.name)}</div>}
        <div className="cc-id">
          <b className="cc-name">{person.name}</b>
          <div className="cc-meta">
            {person.verified ? <span className="cc-verified">✓ Verified</span> : null}
            {subtitle ? <span>{subtitle}</span> : since ? <span>Since {since}</span> : null}
          </div>
        </div>
      </div>

      <div className="cc-actions">
        <Link className="cc-btn cc-btn-primary" href={messageHref}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Message
        </Link>
        {person.phone ? (
          <a className="cc-btn" href={`tel:${person.phone.replace(/[^0-9+]/g, "")}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.9 2.1z" /></svg>
            Call
          </a>
        ) : null}
        {person.email ? (
          <a className="cc-btn" href={`mailto:${person.email}`}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="m22 7-10 6L2 7" /></svg>
            Email
          </a>
        ) : null}
      </div>

      {(person.phone || person.email) && (
        <div className="cc-contact">
          {person.phone ? <div className="cc-row"><span>Phone</span><b>{person.phone}</b></div> : null}
          {person.email ? <div className="cc-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}><span>Email</span><b className="cc-email" style={{ textAlign: "left", overflowWrap: "anywhere" }}>{person.email}</b></div> : null}
        </div>
      )}
    </div>
  );
}
