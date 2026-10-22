import Link from "next/link";
import type { Setup } from "@/setups/types";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { availability, bookingTypes } from "../../lib/data";
import { teamOf } from "../../lib/catalog";
import { dayKey, duration, money, relDay, time } from "../../lib/format";
import type { BookingType, Slot, TeamMember } from "../../lib/types";
import { Empty, Ic, Img } from "../bits";
import { VisitBlock } from "../visit-block";

/** For each clinician, the first visit type they see and their next open times. */
async function nextByClinician(types: BookingType[], people: TeamMember[], tz: string) {
  const now = Date.now();
  return Promise.all(people.map(async (m) => {
    const type = types.find((t) => t.hosts.includes(m.email));
    if (!type) return { m, type: undefined as BookingType | undefined, slots: [] as Slot[] };
    const a = await availability(type, { days: 7, host: m.email });
    const slots = (a?.days || []).flatMap((d) => d.slots || []).filter((s) => s.spotsAvailable > 0 && Date.parse(s.startTime) > now);
    // The chips show the first day with times: up to four of them.
    const first = slots[0] ? dayKey(slots[0].startTime, tz) : "";
    return { m, type, slots: slots.filter((s) => dayKey(s.startTime, tz) === first).slice(0, 4) };
  }));
}

/** Cedar's home books a visit: pick a visit type (and a clinician), see who is free
 *  soonest, then the visit types, insurance and the practice itself. */
export async function ClinicHome({ setup, cfg }: { setup: Setup; cfg: SchedulingConfig }) {
  const tz = cfg.timezone;
  const types = (await bookingTypes()).filter((t) => !t.hidden);
  const people = teamOf(types);
  const next = await nextByClinician(types, people, tz);
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
                <select name="type" defaultValue={types[0]?.slug || ""} disabled={!types.length}>
                  {types.length ? types.map((t) => <option key={t.id} value={t.slug}>{t.title} · {duration(t.services[0]?.duration || 0)}</option>) : <option value="">Online booking opens soon</option>}
                </select>
              </label>
              <label>
                <span>Clinician</span>
                <select name="with" defaultValue="" disabled={!people.length}>
                  <option value="">First available</option>
                  {people.map((m) => <option key={m.email} value={m.email}>{m.name}</option>)}
                </select>
              </label>
              <button type="submit" className="btn clay lg" disabled={!types.length}>{cfg.hero.cta} <Ic n="arrow" size={17} /></button>
            </form>
            {cfg.lines && <ul className="cl-lines">{cfg.lines.map((l) => <li key={l}><Ic n="check" size={16} /> {l}</li>)}</ul>}
          </div>
          <div className="cl-hero-r">
            <Img src={cfg.hero.image} alt={cfg.hero.imageAlt} w={1200} />
            {soonest && soonest.type && (
              <Link className="cl-soon" href={`/book/${soonest.type.slug}?at=${encodeURIComponent(soonest.slots[0].startTime)}&with=${encodeURIComponent(soonest.m.email)}`}>
                <span className="cl-soon-ph"><Img src={soonest.m.photo} alt="" w={160} /></span>
                <span><small>Next available</small><b>{relDay(soonest.slots[0].startTime, tz)} · {time(soonest.slots[0].startTime, tz)}</b><i>{soonest.m.name}</i></span>
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
            {next.map(({ m, type, slots }) => (
              <article key={m.email} className="cl-doc">
                <div className="cl-doc-top">
                  <span className="cl-doc-ph"><Img src={m.photo} alt={m.name} w={300} /></span>
                  <div>
                    <h3>{m.name}</h3>
                    <p className="cl-doc-t">{m.title}</p>
                    {m.languages?.length ? <p className="cl-doc-l">Speaks {m.languages.join(", ")}</p> : null}
                  </div>
                </div>
                {type && (
                  <div className="cl-doc-times">
                    <p>{slots.length ? <>{relDay(slots[0].startTime, tz)} · {type.title}</> : <>No openings this week for {type.title.toLowerCase()}</>}</p>
                    <div className="cl-chips">
                      {slots.map((s) => <Link key={s.startTime} className="cl-chip" href={`/book/${type.slug}?at=${encodeURIComponent(s.startTime)}&with=${encodeURIComponent(m.email)}`}>{time(s.startTime, tz)}</Link>)}
                      <Link className="cl-chip more" href={`/book/${type.slug}?with=${encodeURIComponent(m.email)}`}>{slots.length ? "More" : "See next week"}</Link>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty title="Online booking opens soon" action={cfg.place.phone ? <a className="btn clay sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> Call {cfg.place.phone}</a> : undefined}>
            Our clinicians&rsquo; calendars aren&rsquo;t online yet. Call the front desk and we&rsquo;ll find you a time this week.
          </Empty>
        )}
      </section>

      {types.length > 0 && (
        <section className="cl-types-band">
          <div className="wrap">
            <div className="sc-head"><h2>{cfg.words.types}</h2><p>Prices are for patients paying for themselves. With insurance, you pay your plan&rsquo;s copay.</p></div>
            <div className="cl-types">
              {types.map((t) => (
                <Link key={t.id} href={`/book?type=${t.slug}`} className="cl-type">
                  <span className="cl-type-ic"><Ic n={t.video ? "video" : t.sameDay ? "clock" : "doc"} /></span>
                  <span className="cl-type-t">{t.title}</span>
                  <span className="cl-type-d">{t.description}</span>
                  <span className="cl-type-m">{duration(t.services[0]?.duration || 0)}{t.price ? ` · Self-pay ${money(t.price)}` : ""}{t.video ? " · From home" : ""}</span>
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
