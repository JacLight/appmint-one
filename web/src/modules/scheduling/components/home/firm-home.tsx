import Link from "next/link";
import type { Setup } from "@/setups/types";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { availability, bookingTypes } from "../../lib/data";
import { hostOf, teamOf } from "../../lib/catalog";
import { duration, money, relDay, time } from "../../lib/format";
import { Empty, Ic, Img } from "../bits";
import { VisitBlock } from "../visit-block";

/** Hale & Mercer's home books a consultation: the promise and the button, then the
 *  practice areas (each a consultation with its fee, length, attorney and next opening),
 *  the attorneys, how fees work and the office. */
export async function FirmHome({ setup, cfg }: { setup: Setup; cfg: SchedulingConfig }) {
  const tz = cfg.timezone;
  const types = (await bookingTypes()).filter((t) => !t.hidden && t.kind !== "meeting");
  const people = teamOf(types);
  const next = await Promise.all(types.map((t) => availability(t, { days: 14 })));
  const opening = (i: number) => {
    const n = next[i]?.nextAvailable;
    return n && Date.parse(n.startTime) > Date.now() ? n.startTime : (next[i]?.days || []).flatMap((d) => d.slots).find((s) => s.spotsAvailable > 0 && Date.parse(s.startTime) > Date.now())?.startTime;
  };
  const fee = (f?: number) => (f === undefined ? "" : f > 0 ? `${money(f)} consultation` : "Free consultation");

  return (
    <div className="scm sc-firm">
      <section className="fm-hero">
        <div className="wrap fm-hero-in">
          <div className="fm-hero-l">
            {cfg.hero.kicker && <p className="fm-kick">{cfg.hero.kicker}</p>}
            <h1>{cfg.hero.title} <em>{cfg.hero.em}</em></h1>
            <p className="fm-sub">{cfg.hero.sub}</p>
            <div className="fm-acts">
              <Link className="btn fm-brass lg" href="/book">{cfg.hero.cta}</Link>
              {cfg.place.phone && <a className="fm-call" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={17} /> {cfg.place.phone}</a>}
            </div>
            {cfg.lines && <ul className="fm-lines">{cfg.lines.map((l) => <li key={l}>{l}</li>)}</ul>}
          </div>
          <div className="fm-hero-r"><Img src={cfg.hero.image} alt={cfg.hero.imageAlt} w={1200} /></div>
        </div>
      </section>

      <section className="wrap sc-sec">
        <div className="sc-head"><h2>{cfg.words.types}</h2><p>Each consultation is with the attorney who practises in that area.</p></div>
        {types.length ? (
          <div className="fm-areas">
            {types.map((t, i) => {
              const a = hostOf(t, t.hosts);
              const at = opening(i);
              return (
                <Link key={t.id} href={`/book/${t.slug}`} className="fm-area">
                  <span className="fm-area-ph"><Img src={t.image} alt="" w={700} /></span>
                  <span className="fm-area-b">
                    <span className="fm-area-n">{t.area || t.title}</span>
                    <span className="fm-area-d">{t.description}</span>
                    <span className="fm-area-f">{[fee(t.price), duration(t.services[0]?.duration || 0)].filter(Boolean).join(" · ")}</span>
                    {a && <span className="fm-area-a"><span className="fm-area-av"><Img src={a.photo} alt="" w={120} /></span><span>with {a.name}<small>{at ? `Next opening ${relDay(at, tz)}, ${time(at, tz)}` : "Call for the next opening"}</small></span></span>}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <Empty title="Consultations open for online booking soon" action={cfg.place.phone ? <a className="btn clay sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> Call {cfg.place.phone}</a> : undefined}>
            Until then, call the office and we&rsquo;ll arrange a time with the right attorney and run the conflict check before you come in.
          </Empty>
        )}
      </section>

      {people.length > 0 && (
        <section className="fm-team-band">
          <div className="wrap">
            <div className="sc-head"><h2>{cfg.words.team}</h2><Link className="sc-more" href="/team">All attorneys <Ic n="arrow" size={16} /></Link></div>
            <div className="fm-team">
              {people.map((m) => {
                const t = types.find((x) => x.hosts.includes(m.email));
                return (
                  <article key={m.email} className="fm-person">
                    <span className="fm-person-ph"><Img src={m.photo} alt={m.name} w={600} /></span>
                    <h3>{m.name}</h3>
                    <p className="fm-person-t">{[m.title, m.practice].filter(Boolean).join(" · ")}</p>
                    {m.credentials && <p className="fm-person-c">{m.credentials}</p>}
                    {t && <Link className="fm-person-go" href={`/book/${t.slug}?with=${encodeURIComponent(m.email)}`}>Book with {m.name.split(" ")[0]} <Ic n="arrow" size={15} /></Link>}
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="wrap sc-sec fm-fees">
        <div>
          <p className="eyebrow">Fees</p>
          <h2>What a first meeting costs.</h2>
          {cfg.policy && <p className="fm-sub dark">{cfg.policy}</p>}
        </div>
        {types.length > 0 ? (
          <table className="fm-fee-t">
            <tbody>
              {types.map((t) => (
                <tr key={t.id}><th>{t.area || t.title}</th><td>{duration(t.services[0]?.duration || 0)}</td><td>{t.price ? money(t.price) : "No charge"}</td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="fm-sub dark">Fees for each practice area are listed here once consultations open online.</p>
        )}
      </section>

      <VisitBlock cfg={cfg} title={`Visit ${setup.brand.name}`} />
    </div>
  );
}
