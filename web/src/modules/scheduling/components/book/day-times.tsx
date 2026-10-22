"use client";

import Link from "next/link";
import { useState } from "react";

export interface DayTimesDay {
  key: string;
  wd: string;      // "Today", "Fri"
  d: string;       // "23"
  mon: string;     // "Oct"
  times: { label: string; href: string; hour: number }[];
}

const PARTS: [string, (h: number) => boolean][] = [
  ["Morning", (h) => h < 12],
  ["Afternoon", (h) => h >= 12 && h < 17],
  ["Evening", (h) => h >= 17],
];

/** One person's week: a slim day picker with how many times are open each day, then every
 *  open time of the chosen day, grouped by morning, afternoon and evening. */
export function DayTimes({ days, emptyNote }: { days: DayTimesDay[]; emptyNote: React.ReactNode }) {
  const first = days.find((d) => d.times.length)?.key || days[0]?.key;
  const [on, setOn] = useState(first);
  const day = days.find((d) => d.key === on) || days[0];
  if (!days.some((d) => d.times.length)) return <div className="dr-week"><p className="dr-none">{emptyNote}</p></div>;
  return (
    <div className="dr-week">
      <div className="dr-seg" role="tablist" aria-label="Pick a day">
        {days.map((d) => (
          <button key={d.key} type="button" role="tab" aria-selected={d.key === on} disabled={!d.times.length}
            className={d.key === on ? "on" : undefined} onClick={() => setOn(d.key)}>
            <span>{d.wd}</span>
            <b>{d.d}</b>
            <i>{d.times.length || "–"}</i>
          </button>
        ))}
      </div>
      <div className="dr-times" role="tabpanel">
        {PARTS.map(([label, test]) => {
          const list = day?.times.filter((t) => test(t.hour)) || [];
          if (!list.length) return null;
          return (
            <div key={label} className="dr-part">
              <span className="dr-part-h">{label}</span>
              <div className="dr-chips">{list.map((t) => <Link key={t.href} className="dr-chip" href={t.href}>{t.label}</Link>)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
