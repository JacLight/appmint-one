import Link from "next/link";
import type { Setup } from "@/setups/types";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { bookingTypes, plans } from "../../lib/data";
import { teamOf } from "../../lib/catalog";
import { dayKey, duration, keyLong, todayKey } from "../../lib/format";
import { firstOpenDay, timetable } from "../../lib/timetable";
import { DayStrip, Empty, Ic, Img } from "../bits";
import { ClassRows } from "../studio/class-rows";
import { PlanLadder } from "../studio/plan-ladder";
import { TeamGrid } from "../team-grid";
import { VisitBlock } from "../visit-block";

/** Lumen's home is the timetable: the hero says one thing and books, then today's
 *  classes with times, coaches and spots left, then the classes, the coaches, the
 *  prices and where to find us. Everything bookable is live engine data. */
export async function StudioHome({ setup, cfg }: { setup: Setup; cfg: SchedulingConfig }) {
  const tz = cfg.timezone;
  const [tt, types, ladder] = await Promise.all([timetable(tz, todayKey(tz), 7), bookingTypes(), plans()]);
  const day = firstOpenDay(tt);
  const rows = tt.byDay[day] || [];
  const counts = Object.fromEntries(tt.days.map((k) => [k, tt.byDay[k].length]));
  const classTypes = types.filter((t) => t.kind === "class" && !t.hidden);
  const privateType = types.find((t) => t.kind === "private" && !t.hidden);
  const coaches = teamOf(types);
  const intro = ladder.find((p) => p.badge && /start/i.test(p.badge)) || null;
  const weekCount: Record<string, number> = {};
  for (const k of tt.days) for (const r of tt.byDay[k]) weekCount[r.type.id] = (weekCount[r.type.id] || 0) + 1;

  return (
    <div className="scm sc-studio">
      <section className="st-hero">
        <Img src={cfg.hero.image} alt={cfg.hero.imageAlt} className="st-hero-img" w={2000} />
        <div className="st-hero-shade" />
        <div className="wrap st-hero-in">
          {cfg.hero.kicker && <p className="st-kick">{cfg.hero.kicker}</p>}
          <h1>{cfg.hero.title} {cfg.hero.em && <em>{cfg.hero.em}</em>}</h1>
          <p className="st-sub">{cfg.hero.sub}</p>
          <div className="st-hero-acts">
            <Link className="btn st-btn-light lg" href="/book">{cfg.hero.cta}</Link>
            {intro ? (
              <Link className="st-intro" href={`/memberships/${intro.name}`}>
                <b>New here?</b> {intro.title} · {intro.displayPrice || `$${intro.price}`} <Ic n="arrow" size={16} />
              </Link>
            ) : privateType ? (
              <Link className="st-intro" href={`/book/${privateType.slug}`}><b>Prefer one-to-one?</b> Book a private session <Ic n="arrow" size={16} /></Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="wrap st-sched" id="schedule">
        <div className="st-sched-head">
          <div>
            <p className="eyebrow">This week at {setup.brand.name}</p>
            <h2>{classTypes.length ? (dayKey(new Date(), tz) === day ? "Today’s classes" : keyLong(day)) : "Class schedule"}</h2>
          </div>
          {classTypes.length > 0 && <Link className="sc-more" href={`/book?day=${day}`}>Full schedule <Ic n="arrow" size={16} /></Link>}
        </div>
        {classTypes.length > 0 ? (
          <>
            <DayStrip days={tt.days} active={day} counts={counts} href={(k) => `/book?day=${k}`} />
            {rows.length ? (
              <ClassRows rows={rows.slice(0, 7)} tz={tz} />
            ) : (
              <Empty title="Every class this week is under way or booked">New times open every morning for the week ahead.</Empty>
            )}
            {rows.length > 7 && <Link className="sc-more st-more-row" href={`/book?day=${day}`}>{rows.length - 7} more on {keyLong(day)} <Ic n="arrow" size={16} /></Link>}
          </>
        ) : (
          <div className="st-closed">
            <div>
              <h3>The timetable is being set for the season.</h3>
              <p>Call the front desk and we&rsquo;ll put you on the list for the first classes, or come by and try a reformer.</p>
              <div className="st-closed-a">
                {cfg.place.phone && <a className="btn ink" href={`tel:${cfg.place.phone.replace(/[^0-9+]/g, "")}`}><Ic n="phone" size={16} /> {cfg.place.phone}</a>}
                <Link className="btn ghost" href="/signup">Create your account</Link>
              </div>
            </div>
            {cfg.lines?.length ? (
              <ul className="st-facts">
                {cfg.lines.map((l) => <li key={l}><Ic n="check" size={16} /> {l}</li>)}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      {classTypes.length > 0 && (
        <section className="wrap sc-sec">
          <div className="sc-head"><h2>{cfg.words.types}</h2><p>Every class is capped at the number of reformers in the room.</p></div>
          <div className="st-types">
            {classTypes.map((t) => (
              <Link key={t.id} href={`/book?type=${t.slug}`} className="st-type">
                <Img src={t.image} alt="" w={700} />
                <span className="st-type-shade" />
                <span className="st-type-meta">{[t.level, duration(t.services[0]?.duration || 0)].filter(Boolean).join(" · ")}</span>
                <span className="st-type-t">{t.title}</span>
                <span className="st-type-d">{t.description}</span>
                <span className="st-type-n">{weekCount[t.id] ? `${weekCount[t.id]} times this week` : "Check the schedule"}</span>
              </Link>
            ))}
            {privateType && (
              <Link href={`/book/${privateType.slug}`} className="st-type st-type-private">
                <Img src={privateType.image} alt="" w={700} />
                <span className="st-type-shade" />
                <span className="st-type-meta">One-to-one · {duration(privateType.services[0]?.duration || 0)}</span>
                <span className="st-type-t">{privateType.title}</span>
                <span className="st-type-d">{privateType.description}</span>
                <span className="st-type-n">Choose your coach</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {coaches.length > 0 && (
        <section className="wrap sc-sec">
          <div className="sc-head"><h2>{cfg.words.team}</h2><Link className="sc-more" href="/team">Meet the team <Ic n="arrow" size={16} /></Link></div>
          <TeamGrid people={coaches} variant="round" />
        </section>
      )}

      {ladder.length > 0 && (
        <section className="st-pricing">
          <div className="wrap">
            <div className="sc-head"><h2>Packs &amp; memberships</h2><Link className="sc-more" href="/memberships">All pricing <Ic n="arrow" size={16} /></Link></div>
            <PlanLadder plans={ladder} />
            {cfg.policy && <p className="st-policy">{cfg.policy}</p>}
          </div>
        </section>
      )}

      <VisitBlock cfg={cfg} />
    </div>
  );
}
