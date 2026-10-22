"use client";

import { useMemo, useState } from "react";
import { I } from "./icons";
import { addDays, isoDay, ymd } from "./shared";

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthStart(s: string) { const d = ymd(s); d.setUTCDate(1); return isoDay(d); }
function addMonths(s: string, n: number) { const d = ymd(s); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); return isoDay(d); }
export function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/**
 * Two-month date-range picker (check-in → check-out). `blocked` days can't be stayed;
 * the first blocked day after check-in can still be the check-out day.
 */
export function RangeCalendar({
  from, to, onChange, months = 2, blocked, minNights = 1, single = false,
}: {
  from?: string | null; to?: string | null; onChange: (from: string | null, to: string | null) => void;
  months?: 1 | 2; blocked?: Set<string>; minNights?: number; single?: boolean;
}) {
  const today = todayIso();
  const [view, setView] = useState(() => monthStart(from || today));
  const firstBlockedAfter = useMemo(() => {
    if (!from || to || !blocked?.size) return null;
    let best: string | null = null;
    for (const b of blocked) if (b > from && (!best || b < best)) best = b;
    return best;
  }, [from, to, blocked]);

  function state(day: string) {
    const past = day < today;
    const isBlocked = !!blocked?.has(day);
    let disabled = past;
    if (!past) {
      if (from && !to && !single) {
        if (day > from) {
          const tooShort = day < addDays(from, minNights);
          const beyond = firstBlockedAfter && day > firstBlockedAfter;
          disabled = !!(tooShort || beyond);
        } else disabled = isBlocked;
      } else disabled = isBlocked;
    }
    return { past, disabled, isBlocked };
  }

  function pick(day: string) {
    if (single) { onChange(day, day); return; }
    if (!from || (from && to) || day <= from) { onChange(day, null); return; }
    onChange(from, day);
  }

  const shown = Array.from({ length: months }, (_, i) => addMonths(view, i));
  const canBack = view > monthStart(today);

  return (
    <div className={`mk-cal${months === 1 ? " one" : ""}`}>
      {shown.map((m, idx) => {
        const first = ymd(m);
        const lead = first.getUTCDay();
        const dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
        const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
        return (
          <div key={m}>
            <div className="mk-cal-head">
              {idx === 0 ? <button type="button" className="mk-cal-nav" disabled={!canBack} onClick={() => setView(addMonths(view, -1))} aria-label="Previous month">{I.left}</button> : <span style={{ width: 32 }} />}
              <b>{label}</b>
              {idx === shown.length - 1 ? <button type="button" className="mk-cal-nav" onClick={() => setView(addMonths(view, 1))} aria-label="Next month">{I.right}</button> : <span style={{ width: 32 }} />}
            </div>
            <div className="mk-cal-grid">
              {DOW.map((d) => <div key={d} className="mk-cal-dow">{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} className="mk-cal-day empty" />)}
              {Array.from({ length: dim }, (_, i) => {
                const day = `${m.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
                const s = state(day);
                const isStart = from === day;
                const isEnd = to === day;
                const inRange = !!(from && to && day > from && day < to);
                const cls = ["mk-cal-day", s.past ? "past" : "", isStart ? "start" : "", isEnd ? "end" : "", inRange ? "in-range" : ""].filter(Boolean).join(" ");
                return (
                  <button type="button" key={day} className={cls} disabled={s.disabled && !isStart} onClick={() => pick(day)} aria-label={day} aria-pressed={isStart || isEnd}>
                    <span>{i + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
