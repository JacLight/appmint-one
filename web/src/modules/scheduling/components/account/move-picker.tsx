import Link from "next/link";
import type { SchedulingConfig } from "@/setups/scheduling-config";
import { availability } from "../../lib/data";
import { hostOf } from "../../lib/catalog";
import { dayKey, dayLong, isKey, keyLong, time, todayKey, when } from "../../lib/format";
import type { BookingDetail, BookingType } from "../../lib/types";
import { DayStrip, Empty, Ic } from "../bits";
import { MoveTo } from "./move-to";

/** Move a booking: same type, same person, a new time from the next two weeks. The
 *  booking's own seat reads as free (availability `excludeReservationId`). */
export async function MovePicker({ cfg, detail, type, who, base, back, done, day: dayQ, at }: {
  cfg: SchedulingConfig; detail: BookingDetail; type: BookingType; who: { id: string } | { email: string; number: string };
  /** The page's own URL with its fixed query, ending in "?" or "&". */
  base: string; back: string; done: string; day?: string; at?: string;
}) {
  const tz = cfg.timezone;
  const b = detail.booking;
  const person = hostOf(type, b.hosts);
  const hostEmail = type.kind === "class" ? undefined : b.hosts[0];
  const a = await availability(type, { from: todayKey(tz), days: 14, host: hostEmail, service: b.service, exclude: b.id });
  const now = Date.now();
  const slots = (a?.days || []).flatMap((d) => d.slots || []).filter((s) => s.spotsAvailable > 0 && Date.parse(s.startTime) > now && Date.parse(s.startTime) !== Date.parse(b.startTime));
  const days = (a?.days || []).map((d) => d.date).filter(isKey);
  const counts = Object.fromEntries(days.map((k) => [k, slots.filter((s) => dayKey(s.startTime, tz) === k).length]));
  const day = at ? dayKey(at, tz) : isKey(dayQ) && days.includes(dayQ) ? dayQ : days.find((k) => counts[k] > 0) || days[0];
  const daySlots = slots.filter((s) => dayKey(s.startTime, tz) === day);

  return (
    <div className="mv">
      <Link href={back} className="bt-back"><Ic n="back" size={16} /> Back</Link>
      <h1 className="mv-h">Move to another time</h1>
      <p className="cv-quiet">Now: <b>{when(b.startTime, tz)}</b> · {type.title}{person ? ` with ${person.name}` : ""}</p>
      {!a ? (
        <Empty title="Times aren’t loading right now">Please refresh in a moment{cfg.place.phone ? `, or call ${cfg.place.phone}` : ""}.</Empty>
      ) : !slots.length ? (
        <Empty title="No other times open in the next two weeks">{cfg.place.phone ? `Call ${cfg.place.phone} and we’ll sort it out.` : ""}</Empty>
      ) : (
        <>
          <DayStrip days={days} active={day!} counts={counts} href={(k) => `${base}day=${k}`} />
          <p className="bt-dayh">{keyLong(day!)}</p>
          <div className="bt-chips">
            {daySlots.map((s) => <Link key={s.startTime} scroll={false} href={`${base}at=${encodeURIComponent(s.startTime)}`} className={`cl-chip${at && Date.parse(s.startTime) === Date.parse(at) ? " on" : ""}`}>{time(s.startTime, tz)}</Link>)}
            {!daySlots.length && <p className="bt-none">Nothing open this day.</p>}
          </div>
          {at && !Number.isNaN(Date.parse(at)) && (
            <div className="bt-card mv-card">
              <p className="eyebrow">New time</p>
              <h2>{dayLong(at, tz)}, {time(at, tz)}</h2>
              <MoveTo who={who} startTime={at} label="Move it here" done={done} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
