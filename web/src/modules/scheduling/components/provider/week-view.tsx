import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { addDays, dayKey, isKey, keyLong, keyParts, todayKey } from "../../lib/format";
import { myTimes } from "../../lib/provider-data";
import { Empty, Ic } from "../bits";
import { SessionCard } from "./session-card";
import { ProviderLimits } from "./provider-limits";

/** A week of the provider's taken times, day by day. */
export async function WeekView({ from: fromQ, title, base }: { from?: string; title: string; base: string }) {
  const [setup, session] = await Promise.all([getSetup(), getSession()]);
  const cfg = setup.scheduling!;
  const tz = cfg.timezone;
  const today = todayKey(tz);
  const from = isKey(fromQ) && fromQ >= today ? fromQ : today;
  const times = await myTimes(session.customer?.email || "", from, 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const p0 = keyParts(days[0]), p6 = keyParts(days[6]);
  return (
    <>
      <div className="pv-top">
        <div><p className="eyebrow">{p0.mon} {p0.d} – {p6.mon} {p6.d}</p><h1>{title}</h1></div>
        <div className="bk-week">
          {from > today ? <Link className="bk-wk" href={`${base}?from=${addDays(from, -7) < today ? today : addDays(from, -7)}`} aria-label="Previous week"><Ic n="back" size={16} /></Link> : <span className="bk-wk off"><Ic n="back" size={16} /></span>}
          {from !== today && <Link className="sc-more" href={base}>This week</Link>}
          <Link className="bk-wk" href={`${base}?from=${addDays(from, 7)}`} aria-label="Next week"><Ic n="arrow" size={16} /></Link>
        </div>
      </div>
      {times === null ? (
        <Empty title="Your calendar isn’t loading right now">Please try again in a moment.</Empty>
      ) : times.length === 0 ? (
        <Empty title="Nothing booked this week">New bookings show up here as clients make them.</Empty>
      ) : (
        days.map((k) => {
          const list = times.filter((s) => dayKey(s.startTime, tz) === k);
          if (!list.length) return null;
          return (
            <section key={k} className="pv-day">
              <h2>{k === today ? "Today" : keyLong(k)}</h2>
              <div className="pv-list">{list.map((s) => <SessionCard key={`${s.type.id}-${s.startTime}`} s={s} tz={tz} />)}</div>
            </section>
          );
        })
      )}
      <ProviderLimits style={cfg.style} />
    </>
  );
}
