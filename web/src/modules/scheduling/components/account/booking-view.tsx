import Link from "next/link";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { hostOf, isClosed } from "../../lib/catalog";
import { dayLong, duration, statusLabel, time, when } from "../../lib/format";
import type { BookingDetail, BookingType, FormAnswer } from "../../lib/types";
import { Avatar, Empty, Ic, Img, StatusPill } from "../bits";
import { CancelButton } from "./cancel-button";

const LABELS: Record<string, string> = { reason: "Reason", area: "Practice area", opposingParty: "Other parties", insurance: "Insurance" };

export interface BookingViewProps {
  cfg: SchedulingConfig;
  detail: BookingDetail;
  type?: BookingType;
  /** The word for one booking in this setup ("Class", "Appointment", "Matter"). */
  one: string;
  /** Signed-in: the booking id. Guest: the email + number that prove it is theirs. */
  who: { id: string } | { email: string; number: string };
  moveHref: string;
  /** The booking type's form, and whether the customer has sent it (signed in only). */
  form?: { name: string; title: string; sent?: FormAnswer | null; href?: string } | null;
  signedIn: boolean;
}

/** One booking as the reservation record holds it: when and with whom, its status, what
 *  the customer told us, every move, the cancellation — and move or cancel it. */
export function BookingView({ cfg, detail, type, one, who: proof, moveHref, form, signedIn }: BookingViewProps) {
  const tz = cfg.timezone;
  const b = detail.booking;
  const who = hostOf(type, b.hosts);
  const closed = isClosed(b.status);
  const upcoming = Date.parse(b.startTime) > Date.now() && !closed;
  const mins = Math.round((Date.parse(b.endTime) - Date.parse(b.startTime)) / 60000);
  const label = cfg.style === "firm" ? type?.area || type?.title || one : type?.title || detail.serviceName || b.service || one;
  const told = Object.entries(detail.intake).filter(([k]) => k !== "reason");
  const reason = detail.intake.reason || b.notes;
  const kind = cfg.style === "studio" ? "class" : cfg.style === "clinic" ? "appointment" : "consultation";

  const history: { at: string; title: string; text?: string }[] = [];
  if (b.createdAt) history.push({ at: b.createdAt, title: "Booked", text: `${when(detail.moves[0]?.from || b.startTime, tz)}${detail.source && detail.source !== "online" ? ` · by ${detail.source}` : " · online"}` });
  for (const m of detail.moves) history.push({ at: m.at, title: m.byCustomer ? "You moved it" : "Moved by the office", text: `${when(m.from, tz)} → ${when(m.to, tz)}${m.reason && !m.byCustomer ? ` · ${m.reason}` : ""}` });
  if (detail.usedAt) history.push({ at: detail.usedAt, title: "Checked in" });
  if (detail.cancelledAt) history.push({ at: detail.cancelledAt, title: "Cancelled", text: detail.cancelReason || undefined });
  history.sort((x, y) => String(y.at).localeCompare(String(x.at)));

  return (
    <>
      <header className="cv-head">
        <div className="cv-ph"><Img src={type?.image} alt="" w={500} /></div>
        <div className="cv-b">
          <p className="eyebrow">{cfg.style === "firm" ? `Matter #${b.number}` : `${one} #${b.number}`}</p>
          <h1>{label}</h1>
          <ul className="cv-facts">
            <li><Ic n="cal" size={16} /> {dayLong(b.startTime, tz)}, {time(b.startTime, tz)}{mins > 0 ? ` · ${duration(mins)}` : ""}</li>
            <li><Ic n={type?.video || b.meetingLink ? "video" : "pin"} size={16} /> {type?.video || b.meetingLink ? "Video" : [type?.room, cfg.place.name].filter(Boolean).join(" · ")}</li>
            {who && <li><Avatar m={who} size={22} /> {who.name}{who.title ? `, ${who.title}` : ""}</li>}
          </ul>
        </div>
        <div className="cv-st"><StatusPill status={b.status} label={statusLabel(b.status)} /></div>
      </header>

      {(upcoming || (who && signedIn)) && (
        <div className="cv-acts">
          {upcoming && <Link className="btn ghost sm" href={moveHref}><Ic n="cal" size={15} /> Move to another time</Link>}
          {who && signedIn && <Link className="btn ghost sm" href={`/account/messages/${encodeURIComponent(who.email)}`}><Ic n="chat" size={15} /> Message {who.name.replace(/,.*$/, "")}</Link>}
          {b.meetingLink && upcoming && <a className="btn clay sm" href={b.meetingLink} target="_blank" rel="noreferrer"><Ic n="video" size={15} /> Join video</a>}
          {upcoming && <CancelButton who={proof} label={`Cancel ${kind}`} note={`We’ll free up the time and email you a confirmation.`} />}
        </div>
      )}

      <div className="cv-grid">
        <div className="cv-main">
          {form && upcoming && !form.sent && (
            <section className="cv-sec">
              <h2>Before you come in</h2>
              <ul className="cv-todo">
                <li><Ic n="doc" /><span><b>{form.title}</b>{cfg.style === "clinic" ? "Please fill it in before your visit." : "Helps us prepare before we meet."}</span>{form.href ? <Link className="btn clay sm" href={form.href}>Fill in</Link> : null}</li>
              </ul>
              {!form.href && <p className="cv-quiet">Sign in with the email on this booking to fill it in online, or we&rsquo;ll go through it with you when you arrive.</p>}
            </section>
          )}

          <section className="cv-sec">
            <h2>What you told us</h2>
            {reason || told.length ? (
              <dl className="pv-intake">
                {reason ? <div><dt>{cfg.style === "studio" ? "Notes" : cfg.style === "clinic" ? "Reason for visit" : "What you need help with"}</dt><dd>{reason}</dd></div> : null}
                {told.map(([k, v]) => <div key={k}><dt>{LABELS[k] || k}</dt><dd>{v}</dd></div>)}
              </dl>
            ) : (
              <p className="cv-quiet">Nothing added when booking.</p>
            )}
          </section>

          <section className="cv-sec">
            <h2>History</h2>
            <ol className="cv-hist">
              {history.map((h, i) => <li key={i}><b>{h.title}</b>{h.text && <span>{h.text}</span>}<i>{when(h.at, tz)}</i></li>)}
            </ol>
          </section>
        </div>

        <aside className="cv-side">
          {form?.sent && (
            <section className="cv-card"><h3>{form.title}</h3><p className="cv-quiet"><Ic n="check" size={14} /> Sent{form.sent.submittedAt ? ` ${when(form.sent.submittedAt, tz)}` : ""}</p></section>
          )}
          {cfg.style !== "studio" && signedIn && (
            <section className="cv-card">
              <h3>Invoices</h3>
              <p className="cv-quiet">{cfg.style === "clinic" ? "Bills from your visits, with what’s left to pay." : "Invoices for your matters, with what’s left to pay."}</p>
              <Link className="btn ghost sm" href="/account/scheduling#invoices"><Ic n="card" size={15} /> Your invoices</Link>
            </section>
          )}
          {cfg.style !== "studio" && signedIn && (
            <section className="cv-card">
              <h3>Documents</h3>
              <p className="cv-quiet">{cfg.style === "clinic" ? "Upload insurance cards, referrals or results for your care team." : "Share contracts, letters and anything else your attorney should see."}</p>
              <Link className="btn ghost sm" href="/account/documents"><Ic n="doc" size={15} /> Your documents</Link>
            </section>
          )}
          <section className="cv-card">
            <h3>{cfg.place.name}</h3>
            <p className="cv-quiet">{cfg.place.street}, {cfg.place.city}{cfg.place.phone ? ` · ${cfg.place.phone}` : ""}</p>
            {cfg.policy && <p className="cv-quiet">{cfg.policy}</p>}
          </section>
        </aside>
      </div>
      {closed && <Empty title={`This ${one.toLowerCase()} was ${statusLabel(b.status).toLowerCase()}`} action={<Link className="btn clay sm" href={type ? `/book/${type.slug}` : "/book"}>Book again</Link>} />}
    </>
  );
}
