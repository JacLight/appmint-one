import Link from "next/link";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { bookingTypes, myMemberships } from "../../lib/data";
import { getSession } from "@/lib/auth";
import { isKey, keyLong, todayKey } from "../../lib/format";
import { firstOpenDay, timetable } from "../../lib/timetable";
import { DayStrip, Empty, Ic, Img } from "../bits";
import { ClassRows } from "../studio/class-rows";

/** The full timetable: two weeks of days, filter by kind of class, every class time
 *  with its coach and spots left. */
export async function StudioSchedule({ cfg, day: wanted, type: typeSlug }: { cfg: SchedulingConfig; day?: string; type?: string }) {
  const tz = cfg.timezone;
  const [tt, types, session] = await Promise.all([timetable(tz, todayKey(tz), 14), bookingTypes(), getSession()]);
  const memberships = session.signedIn ? await myMemberships() : [];
  const cats = [...new Set(tt.types.map((t) => t.category).filter(Boolean))] as string[];
  const typeFilter = tt.types.find((t) => t.slug === typeSlug);
  const cat = !typeFilter && typeSlug && cats.some((c) => c.toLowerCase() === typeSlug.toLowerCase()) ? cats.find((c) => c.toLowerCase() === typeSlug.toLowerCase()) : undefined;
  const keep = (r: { type: { id: string; category?: string } }) => (typeFilter ? r.type.id === typeFilter.id : cat ? r.type.category === cat : true);
  const counts = Object.fromEntries(tt.days.map((k) => [k, tt.byDay[k].filter(keep).length]));
  const filtered = { ...tt, byDay: Object.fromEntries(tt.days.map((k) => [k, tt.byDay[k].filter(keep)])) };
  const day = isKey(wanted) && tt.days.includes(wanted) ? wanted : firstOpenDay(filtered);
  const rows = filtered.byDay[day] || [];
  const privateType = types.find((t) => t.kind === "private" && !t.hidden);
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/book?${s}` : "/book";
  };
  const active = memberships.filter((m) => m.active);

  return (
    <div className="scm sc-studio">
      <section className="bk-band">
        <div className="wrap bk-band-in">
          <div>
            <p className="eyebrow">Book a class</p>
            <h1>Class schedule</h1>
            <p className="bk-sub">{cfg.place.street} · {cfg.lines?.[1] || ""}</p>
          </div>
          {session.signedIn && (
            <div className="bk-credit">
              {active.length ? (
                <><span>Your {active[0].kind === "pack" ? "pack" : "membership"}</span><b className="bk-credit-t">{active.map((m) => m.title).join(", ")}</b></>
              ) : (
                <><span>No membership yet</span><Link href="/memberships" className="sc-more">See packs &amp; memberships</Link></>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="wrap bk-body">
        {tt.types.length === 0 ? (
          <Empty title="The timetable is being set for the season" action={cfg.place.phone ? <a className="btn clay sm" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> {cfg.place.phone}</a> : undefined}>
            Classes appear here as soon as they open for booking. Call the front desk to hear about the first ones.
          </Empty>
        ) : (
          <>
            <nav className="bk-filters" aria-label="Kind of class">
              <Link href={q({ day })} className={!typeFilter && !cat ? "on" : ""}>All classes</Link>
              {cats.map((c) => <Link key={c} href={q({ day, type: c.toLowerCase() })} className={cat === c ? "on" : ""}>{c}</Link>)}
              {typeFilter && <span className="on">{typeFilter.title} <Link href={q({ day })} aria-label="Clear filter"><Ic n="x" size={14} /></Link></span>}
              {privateType && <Link href={`/book/${privateType.slug}`} className="bk-private">Private session <Ic n="arrow" size={14} /></Link>}
            </nav>
            <DayStrip days={tt.days} active={day} counts={counts} href={(k) => q({ day: k, type: typeFilter?.slug || cat?.toLowerCase() })} />
            <h2 className="bk-dayh">{keyLong(day)}</h2>
            {rows.length ? <ClassRows rows={rows} tz={tz} /> : <Empty title={`Nothing left to book on ${keyLong(day)}`}>Pick another day above{typeFilter || cat ? ", or show all classes" : ""}.</Empty>}
            {privateType && (
              <Link href={`/book/${privateType.slug}`} className="bk-private-card">
                <Img src={privateType.image} alt="" w={500} />
                <span><b>{privateType.title}</b><i>{privateType.description}</i></span>
                <span className="btn ghost sm">Choose a coach</span>
              </Link>
            )}
            {cfg.policy && <p className="st-policy">{cfg.policy}</p>}
          </>
        )}
      </section>
    </div>
  );
}
