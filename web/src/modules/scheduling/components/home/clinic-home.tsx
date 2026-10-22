import Link from "next/link";
import type { Setup } from "@/setups/types";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { availability, bookingTypes } from "../../lib/data";
import { bookablesOf, reasonsOf, type Bookable } from "../../lib/catalog";
import { dayKey, duration, money, relDay, time, zoneName } from "../../lib/format";
import type { Slot } from "../../lib/types";
import { Empty, Ic, Img } from "../bits";
import { VisitBlock } from "../visit-block";

/** Each clinician's next open times (the first day that has any, up to four), in their own zone. */
async function nextByClinician(people: Bookable[]) {
  const now = Date.now();
  return Promise.all(people.map(async (b) => {
    const tz = b.type.timezone;
    const a = await availability(b.type, { days: 7, host: b.member.email || undefined });
    const slots = (a?.days || []).flatMap((d) => d.slots || []).filter((s) => s.spotsAvailable > 0 && Date.parse(s.startTime) > now);
    const first = slots[0] ? dayKey(slots[0].startTime, tz) : "";
    return { ...b, tz, slots: slots.filter((s) => dayKey(s.startTime, tz) === first).slice(0, 4) as Slot[] };
  }));
}

/** Where a time with this person is booked. */
const at = (b: Bookable, iso?: string) => {
  const u = new URLSearchParams();
  if (iso) u.set("at", iso);
  if (b.member.email) u.set("with", b.member.email);
  const q = u.toString();
  return `/book/${b.type.slug}${q ? `?${q}` : ""}`;
};

/** Cedar's home books a visit: pick a visit type (and a clinician), see who is free
 *  soonest, then the visit types, insurance and the practice itself. */
export async function ClinicHome({ setup, cfg }: { setup: Setup; cfg: SchedulingConfig }) {
  const types = (await bookingTypes()).filter((t) => !t.hidden && t.kind !== "meeting" && t.kind !== "class");
  const people = bookablesOf(types);
  const reasons = reasonsOf(types);
  const next = await nextByClinician(people);
  const soonest = next.filter((n) => n.slots[0]).sort((a, b) => a.slots[0].startTime.localeCompare(b.slots[0].startTime))[0];

  return (
    <div className="scm sc-clinic">
      <section className="cl-hero">
        <div className="wrap cl-hero-in">
          <div className="cl-hero-l">
            {cfg.hero.kicker && <p className="eyebrow">{cfg.hero.kicker}</p>}
            <h1>{cfg.hero.title} {cfg.hero.em && <em>{cfg.hero.em}</em>}</h1>
            <p className="cl-sub">{cfg.hero.sub}</p>
            <form className="cl-find" action="/book" method="get">
              <label>
                <span>Reason for visit</span>
                <select name="reason" defaultValue="" disabled={!reasons.length}>
                  <option value="">Any reason</option>
                  {reasons.map((r) => <option key={r.slug} value={r.slug}>{r.name} · {duration(r.duration)}</option>)}
                </select>
              </label>
              <label>
                <span>Clinician</span>
                <select name="type" defaultValue="" disabled={!people.length}>
                  <option value="">Any clinician</option>
                  {people.map((b) => <option key={`${b.type.id}:${b.member.email}`} value={b.type.slug}>{b.member.name}</option>)}
                </select>
              </label>
              <button type="submit" className="btn clay lg" disabled={!people.length}>{cfg.hero.cta} <Ic n="arrow" size={17} /></button>
            </form>
            {cfg.lines && <ul className="cl-lines">{cfg.lines.map((l) => <li key={l}><Ic n="check" size={16} /> {l}</li>)}</ul>}
          </div>
          <div className="cl-hero-r">
            <Img src={cfg.hero.image} alt={cfg.hero.imageAlt} w={1200} />
            {soonest && (
              <Link className="cl-soon" href={at(soonest, soonest.slots[0].startTime)}>
                <span className="cl-soon-ph"><Img src={soonest.member.photo} alt="" w={160} /></span>
                <span><small>Next available</small><b>{relDay(soonest.slots[0].startTime, soonest.tz)} · {time(soonest.slots[0].startTime, soonest.tz)}</b><i>{soonest.member.name}</i></span>
              </Link>
            )}
            {!soonest && cfg.place.phone && (
              <a className="cl-soon" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}>
                <span className="cl-soon-ic"><Ic n="phone" /></span>
                <span><small>Call to book</small><b>{cfg.place.phone}</b><i>{cfg.place.hours[0]?.join(" · ")}</i></span>
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="wrap sc-sec">
        <div className="sc-head"><h2>{cfg.words.team}</h2>{people.length > 0 && <Link className="sc-more" href="/team">All clinicians <Ic n="arrow" size={16} /></Link>}</div>
        {people.length ? (
          <div className="cl-docs">
            {next.map((b) => (
              <article key={`${b.type.id}:${b.member.email}`} className="cl-doc">
                <div className="cl-doc-top">
                  <span className="cl-doc-ph"><Img src={b.member.photo} alt={b.member.name} w={300} /></span>
                  <div>
                    <h3>{b.member.name}</h3>
                    <p className="cl-doc-t">{b.member.specialties?.join(", ") || b.type.specialty || b.member.title || (b.member.email ? b.type.title : "")}</p>
                    <p className="cl-doc-l">{zoneName(b.tz)}{b.member.languages?.length ? ` · Speaks ${b.member.languages.join(", ")}` : ""}</p>
                  </div>
                </div>
                <div className="cl-doc-times">
                  <p>{b.slots.length ? <>Next open · {relDay(b.slots[0].startTime, b.tz)}</> : <>No openings this week</>}</p>
                  <div className="cl-chips">
                    {b.slots.map((s) => <Link key={s.startTime} className="cl-chip" href={at(b, s.startTime)}>{time(s.startTime, b.tz)}</Link>)}
                    <Link className="cl-chip more" href={`/book?type=${b.type.slug}${b.member.email ? `&with=${encodeURIComponent(b.member.email)}` : ""}`}>{b.slots.length ? "All times" : "Next week"}</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="No clinicians take online bookings yet" action={cfg.place.phone ? <a className="btn clay sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> Call {cfg.place.phone}</a> : undefined}>
            Our clinicians&rsquo; calendars aren&rsquo;t online yet. Call the front desk and we&rsquo;ll find you a time this week.
          </Empty>
        )}
      </section>

      {reasons.length > 0 && (
        <section className="cl-types-band">
          <div className="wrap">
            <div className="sc-head"><h2>{cfg.words.types}</h2><p>Prices are for patients paying for themselves. With insurance, you pay your plan&rsquo;s copay.</p></div>
            <div className="cl-types">
              {reasons.map((r) => (
                <Link key={r.slug} href={`/book?reason=${r.slug}`} className="cl-type">
                  <span className="cl-type-ic"><Ic n={r.video ? "video" : "doc"} /></span>
                  <span className="cl-type-t">{r.name}</span>
                  {r.description && <span className="cl-type-d">{r.description}</span>}
                  <span className="cl-type-m">{duration(r.duration)}{r.price ? ` · Self-pay from ${money(r.price)}` : ""} · {r.count} {r.count === 1 ? "clinician" : "clinicians"}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {cfg.insurance?.length ? (
        <section className="wrap sc-sec cl-ins">
          <div><p className="eyebrow">Insurance</p><h2>We take most plans.</h2><p className="cl-sub">Bring your card to your first visit, or add it on your health history form. Not sure? Call us and we&rsquo;ll check before you come in.</p></div>
          <ul>{cfg.insurance.map((i) => <li key={i}>{i}</li>)}</ul>
        </section>
      ) : null}

      <VisitBlock cfg={cfg} title={`Visit ${setup.brand.name}`} />
    </div>
  );
}
