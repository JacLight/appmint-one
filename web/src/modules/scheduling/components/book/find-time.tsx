import Link from "next/link";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { availability, bookingTypes } from "../../lib/data";
import { addDays, dayKey, duration, isKey, keyParts, money, time, todayKey } from "../../lib/format";
import type { BookingType, Slot } from "../../lib/types";
import { Empty, Ic, Img } from "../bits";

const DAYS = 5;

/**
 * Clinic and firm: choose what it's for (visit type / practice area) on the left; every
 * clinician or attorney who does it on the right, each with five days of open times.
 */
export async function FindTime({ cfg, type: typeSlug, with: withEmail, from: fromQ }: { cfg: SchedulingConfig; type?: string; with?: string; from?: string }) {
  const tz = cfg.timezone;
  const firm = cfg.style === "firm";
  const types = (await bookingTypes()).filter((t) => !t.hidden && t.kind !== "meeting");
  const type = types.find((t) => t.slug === typeSlug) || (withEmail ? types.find((t) => t.hosts.includes(withEmail.toLowerCase())) : undefined) || types[0];
  const today = todayKey(tz);
  const from = isKey(fromQ) && fromQ >= today ? fromQ : today;
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  const people = type ? type.team.filter((m) => type.hosts.includes(m.email) && (!withEmail || m.email === withEmail.toLowerCase())) : [];
  const avail = type ? await Promise.all(people.map((m) => availability(type, { from, days: DAYS, host: m.email }))) : [];
  const now = Date.now();
  const slotsFor = (i: number, k: string): Slot[] => (avail[i]?.days || []).flatMap((d) => d.slots || []).filter((s) => s.spotsAvailable > 0 && Date.parse(s.startTime) > now && dayKey(s.startTime, tz) === k);
  const link = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ type: type?.slug, with: withEmail, from, ...o })) if (v) p.set(k, v);
    return `/book?${p.toString()}`;
  };
  const priceLine = (t: BookingType) => (firm ? (t.price ? `${money(t.price)} consultation` : "Free consultation") : t.price ? `Self-pay ${money(t.price)}` : "");

  return (
    <div className={`scm ${firm ? "sc-firm" : "sc-clinic"}`}>
      <section className="bk-band">
        <div className="wrap bk-band-in">
          <div>
            <p className="eyebrow">{cfg.place.name}</p>
            <h1>{cfg.words.bookCta}</h1>
            <p className="bk-sub">{firm ? "Choose a practice area, then a time with the attorney who handles it." : "Choose the reason for your visit, then a time with any of our clinicians."}</p>
          </div>
        </div>
      </section>

      <section className="wrap bk-body bk-find">
        {!types.length ? (
          <Empty title={firm ? "Consultations open for online booking soon" : "Online booking opens soon"} action={cfg.place.phone ? <a className="btn clay sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> Call {cfg.place.phone}</a> : undefined}>
            {firm ? "Call the office and we’ll arrange a time with the right attorney." : "Call the front desk and we’ll find you a time this week."}
          </Empty>
        ) : (
          <>
            <aside className="bk-types" aria-label={cfg.words.types}>
              <h2>{firm ? "Practice area" : "Reason for visit"}</h2>
              {types.map((t) => (
                <Link key={t.id} href={`/book?type=${t.slug}`} className={`bk-type${t.id === type?.id ? " on" : ""}`}>
                  <b>{firm ? t.area || t.title : t.title}</b>
                  <span>{[duration(t.services[0]?.duration || 0), priceLine(t), t.video ? "Video" : ""].filter(Boolean).join(" · ")}</span>
                </Link>
              ))}
            </aside>

            <div className="bk-people">
              {type && (
                <div className="bk-type-head">
                  <div>
                    <h2>{type.title}</h2>
                    <p>{type.description}</p>
                  </div>
                  <div className="bk-week">
                    {from > today ? <Link href={link({ from: addDays(from, -DAYS) < today ? today : addDays(from, -DAYS) })} className="bk-wk" aria-label="Earlier days"><Ic n="back" size={16} /></Link> : <span className="bk-wk off"><Ic n="back" size={16} /></span>}
                    <span>{keyParts(days[0]).mon} {keyParts(days[0]).d} – {keyParts(days[DAYS - 1]).mon} {keyParts(days[DAYS - 1]).d}</span>
                    <Link href={link({ from: addDays(from, DAYS) })} className="bk-wk" aria-label="Later days"><Ic n="arrow" size={16} /></Link>
                  </div>
                </div>
              )}
              {withEmail && <p className="bk-only">Showing {people[0]?.name || "one person"} only · <Link href={`/book?type=${type?.slug || ""}`}>show everyone</Link></p>}
              {people.length === 0 && <Empty title="Nobody is booking this online yet">{cfg.place.phone ? `Call ${cfg.place.phone} and we’ll book it for you.` : "Please try another option."}</Empty>}
              {people.map((m, i) => {
                const any = days.some((k) => slotsFor(i, k).length);
                return (
                  <article key={m.email} className="bk-person">
                    <div className="bk-person-l">
                      <span className="bk-person-ph"><Img src={m.photo} alt={m.name} w={300} /></span>
                      <div>
                        <h3>{m.name}</h3>
                        <p className="bk-person-t">{[m.title, firm ? m.practice : undefined].filter(Boolean).join(" · ")}</p>
                        {m.credentials && <p className="bk-person-c">{m.credentials}</p>}
                        {m.languages?.length ? <p className="bk-person-c">Speaks {m.languages.join(", ")}</p> : null}
                      </div>
                    </div>
                    <div className="bk-cols">
                      {days.map((k) => {
                        const p = keyParts(k);
                        const s = slotsFor(i, k);
                        return (
                          <div key={k} className="bk-col">
                            <span className="bk-col-h"><b>{k === today ? "Today" : p.wd}</b>{p.mon} {p.d}</span>
                            {s.slice(0, 4).map((x) => <Link key={x.startTime} className="cl-chip" href={`/book/${type!.slug}?at=${encodeURIComponent(x.startTime)}&with=${encodeURIComponent(m.email)}`}>{time(x.startTime, tz)}</Link>)}
                            {s.length > 4 && <Link className="bk-col-more" href={`/book/${type!.slug}?with=${encodeURIComponent(m.email)}&day=${k}`}>+{s.length - 4} more</Link>}
                            {s.length === 0 && <span className="bk-col-none">—</span>}
                          </div>
                        );
                      })}
                    </div>
                    {!any && <p className="bk-person-none">No openings these days. <Link href={link({ from: addDays(from, DAYS) })}>Look at the next {DAYS} days</Link></p>}
                  </article>
                );
              })}
              {cfg.policy && <p className="st-policy">{cfg.policy}</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
