import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { getSession } from "@/lib/auth";
import { availability, bookingType, myMemberships, plans } from "@/modules/scheduling/lib/data";
import { hostOf } from "@/modules/scheduling/lib/catalog";
import { dayKey, dayLong, duration, isKey, keyLong, money, time, todayKey } from "@/modules/scheduling/lib/format";
import { Avatar, DayStrip, Empty, Ic, Img, Spots } from "@/modules/scheduling/components/bits";
import { BookConfirm } from "@/modules/scheduling/components/book/book-confirm";

type P = Promise<{ type: string }>;
type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: { params: P }): Promise<Metadata> {
  const t = await bookingType((await params).type).catch(() => null);
  return { title: t?.title || "Book" };
}

/** One booking type: who with, which day, which time — then confirm. */
export default async function BookTypePage({ params, searchParams }: { params: P; searchParams: SP }) {
  const [{ type: slug }, sp, setup, session] = await Promise.all([params, searchParams, getSetup(), getSession()]);
  const cfg = setup.scheduling!;
  const tz = cfg.timezone;
  const type = await bookingType(slug);
  if (!type || type.hidden || type.kind === "meeting") notFound();

  const people = type.team.filter((m) => type.hosts.includes(m.email));
  const withQ = one(sp.with)?.toLowerCase();
  const host = people.find((m) => m.email === withQ);
  const multi = people.length > 1;
  const atQ = one(sp.at);
  const at = atQ && !Number.isNaN(Date.parse(atQ)) && Date.parse(atQ) > Date.now() ? new Date(atQ).toISOString() : undefined;

  const today = todayKey(tz);
  const avail = await availability(type, { from: today, days: 14, host: host?.email });
  const now = Date.now();
  const allSlots = (avail?.days || []).flatMap((d) => d.slots || []).filter((s) => Date.parse(s.startTime) > now);
  const days = (avail?.days || []).map((d) => d.date).filter(isKey);
  const counts = Object.fromEntries(days.map((k) => [k, allSlots.filter((s) => s.spotsAvailable > 0 && dayKey(s.startTime, tz) === k).length]));
  const dayQ = one(sp.day);
  const day = at ? dayKey(at, tz) : isKey(dayQ) && days.includes(dayQ) ? dayQ : days.find((k) => counts[k] > 0) || days[0] || today;
  const daySlots = allSlots.filter((s) => dayKey(s.startTime, tz) === day);
  const chosen = at ? allSlots.find((s) => s.startTime === at || Date.parse(s.startTime) === Date.parse(at)) : undefined;
  const isClass = type.kind === "class";
  const withMember = host || (isClass ? hostOf(type, type.hosts) : people.length === 1 ? people[0] : undefined);

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ with: host?.email, ...o })) if (v) p.set(k, v);
    const s = p.toString();
    return `/book/${type.slug}${s ? `?${s}` : ""}`;
  };
  const here = href({ at, day: at ? undefined : day });
  const loginHref = `/login?next=${encodeURIComponent(here)}`;
  const signupHref = `/signup?next=${encodeURIComponent(here)}`;

  // Studio: say which membership the customer holds (storefront subscriptions); the
  // engine doesn't tie a booking to a pass, so nothing is counted or required here.
  const s0 = type.services[0];
  let costLine = "";
  if (cfg.style === "studio") {
    const [mine, ladder] = await Promise.all([session.signedIn ? myMemberships() : Promise.resolve([]), plans()]);
    const active = mine.find((m) => m.active);
    costLine = active ? `With your ${active.title}` : ladder.length ? "Members and class-pack holders · see pricing" : "";
  } else if (cfg.style === "clinic") {
    costLine = type.price > 0 ? `Self-pay ${money(type.price)}, or your insurance plan · billed after the visit` : "Billed to your insurance after the visit";
  } else {
    costLine = type.price > 0 ? `Consultation fee ${money(type.price)}, invoiced after we meet` : "No charge for this consultation";
  }
  const cls = cfg.style === "studio" ? "sc-studio" : cfg.style === "clinic" ? "sc-clinic" : "sc-firm";

  return (
    <>
      <SiteHeader />
      <main className={`scm ${cls}`}>
        <section className="wrap bt-top">
          <Link href="/book" className="bt-back"><Ic n="back" size={16} /> {cfg.style === "studio" ? "Class schedule" : cfg.words.bookCta}</Link>
        </section>
        <section className="wrap bt-grid">
          <div className="bt-main">
            <header className="bt-head">
              <div className="bt-head-ph"><Img src={type.image} alt="" w={900} /></div>
              <div className="bt-head-b">
                <p className="eyebrow">{cfg.style === "firm" ? type.area || "Consultation" : type.kind === "class" ? [type.category, type.level].filter(Boolean).join(" · ") || "Class" : type.kind === "private" ? "One-to-one" : type.video ? "Video visit" : "In person"}</p>
                <h1>{type.title}</h1>
                <p className="bt-desc">{type.description}</p>
                <ul className="bt-facts">
                  {s0?.duration ? <li><Ic n="clock" size={16} /> {duration(s0.duration)}</li> : null}
                  {type.room ? <li><Ic n="door" size={16} /> {type.room}</li> : null}
                  {isClass ? <li><Ic n="users" size={16} /> Up to {type.spots}</li> : null}
                  <li><Ic n={type.video ? "video" : "pin"} size={16} /> {type.video ? "From home, by video" : type.location || cfg.place.name}</li>
                </ul>
              </div>
            </header>

            {multi && (
              <div className="bt-who">
                <h2>{type.kind === "private" ? "Choose your coach" : cfg.style === "firm" ? "Attorney" : "Clinician"}</h2>
                <div className="bt-who-row">
                  <Link href={href({ with: undefined, day })} className={`bt-who-any${!host ? " on" : ""}`}>{cfg.style === "studio" ? "Any coach" : "First available"}</Link>
                  {people.map((m) => (
                    <Link key={m.email} href={href({ with: m.email, day })} className={`bt-who-p${host?.email === m.email ? " on" : ""}`}>
                      <Avatar m={m} size={40} /><span><b>{m.name}</b><i>{m.title}</i></span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="bt-when">
              <h2>Pick a time</h2>
              {!avail ? (
                <Empty title="Times aren’t loading right now">Please refresh in a moment{cfg.place.phone ? `, or call ${cfg.place.phone}` : ""}.</Empty>
              ) : days.length === 0 || allSlots.length === 0 ? (
                <Empty title="No open times in the next two weeks">{cfg.place.phone ? `Call ${cfg.place.phone} and we’ll find you one.` : "Please check back soon."}</Empty>
              ) : (
                <>
                  <DayStrip days={days} active={day} counts={counts} href={(k) => href({ day: k })} />
                  <p className="bt-dayh">{keyLong(day)}</p>
                  {daySlots.length === 0 ? (
                    <p className="bt-none">Nothing open this day. Pick another above.</p>
                  ) : isClass ? (
                    <ol className="bt-classes">
                      {daySlots.map((s) => (
                        <li key={s.startTime} className={s.startTime === chosen?.startTime ? "on" : ""}>
                          <b>{time(s.startTime, tz)}</b>
                          <span>{withMember?.name}</span>
                          <Spots left={s.spotsAvailable} total={s.spotsTotal} />
                          {s.spotsAvailable > 0 ? <Link className="btn sm clay" href={href({ at: s.startTime })} scroll={false}>{s.startTime === chosen?.startTime ? "Selected" : "Choose"}</Link> : <span className="btn sm ghost" aria-disabled>Full</span>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="bt-chips">
                      {daySlots.filter((s) => s.spotsAvailable > 0).map((s) => (
                        <Link key={s.startTime} href={href({ at: s.startTime })} scroll={false} className={`cl-chip${s.startTime === chosen?.startTime ? " on" : ""}`}>{time(s.startTime, tz)}</Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="bt-side" id="confirm">
            <div className="bt-card">
              {at ? (
                <>
                  <p className="eyebrow">Your {cfg.style === "studio" ? (isClass ? "class" : "session") : cfg.style === "clinic" ? "visit" : "consultation"}</p>
                  <h2>{type.title}</h2>
                  <ul className="bt-sum">
                    <li><Ic n="cal" size={17} /><span><b>{dayLong(at, tz)}</b>{time(at, tz)}{s0?.duration ? ` · ${duration(s0.duration)}` : ""}</span></li>
                    {withMember ? <li><Avatar m={withMember} size={34} /><span><b>{withMember.name}</b>{withMember.title}</span></li> : <li><Ic n="user" size={17} /><span><b>First available</b>We&rsquo;ll confirm who you&rsquo;ll see</span></li>}
                    <li><Ic n={type.video ? "video" : "pin"} size={17} /><span><b>{type.video ? "Video visit" : cfg.place.name}</b>{type.video ? "We’ll send the link before your visit" : `${cfg.place.street}, ${cfg.place.city}`}</span></li>
                    {costLine && <li><Ic n="card" size={17} /><span><b>{cfg.style === "studio" ? "Membership" : "Cost"}</b>{costLine}</span></li>}
                  </ul>
                  {!chosen && <p className="bk-err">That time may no longer be open — confirming will check it.</p>}
                  <BookConfirm typeId={type.id} startTime={at} host={host?.email || (type.kind !== "class" && people.length === 1 ? people[0].email : undefined)} style={cfg.style}
                    signedIn={session.signedIn} loginHref={loginHref} signupHref={signupHref}
                    insurance={cfg.insurance} area={type.area} cta={cfg.style === "studio" ? "Confirm booking" : cfg.style === "clinic" ? "Book appointment" : "Book consultation"} backHref={href({ day })} />
                  <p className="bk-fine">You can move or cancel it online any time before it starts.</p>
                </>
              ) : (
                <div className="bt-pick">
                  <Ic n="cal" size={22} />
                  <p><b>Pick a time</b> and you&rsquo;ll confirm it here{cfg.style !== "studio" ? " with a few details for us" : ""}.</p>
                  {costLine && <p className="bk-fine">{costLine}</p>}
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
