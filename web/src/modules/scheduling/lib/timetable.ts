import "server-only";
import { availability, bookingTypes } from "./data";
import { hostOf } from "./catalog";
import { addDays, dayKey, todayKey } from "./format";
import type { BookingType, ClassTime, Slot, TeamMember } from "./types";

export interface Timetable {
  tz: string;
  days: string[];                              // YYYY-MM-DD, in order
  byDay: Record<string, ClassTime[]>;
  types: BookingType[];                        // every class type (the timetable's)
}

/** Every group class time from `from` for `days` days, in the business zone. Times that
 *  have already started are left out. One availability call per class type. */
export async function timetable(tz: string, from?: string, days = 7): Promise<Timetable> {
  const all = await bookingTypes();
  const types = all.filter((t) => t.kind === "class" && !t.hidden);
  const start = from || todayKey(tz);
  const keys = Array.from({ length: days }, (_, i) => addDays(start, i));
  const byDay: Record<string, ClassTime[]> = Object.fromEntries(keys.map((k) => [k, []]));
  const now = Date.now();
  const res = await Promise.all(types.map((t) => availability(t, { from: start, days })));
  types.forEach((t, i) => {
    const coach = hostOf(t, t.hosts);
    for (const d of res[i]?.days || []) {
      for (const slot of d.slots || []) {
        if (Date.parse(slot.startTime) <= now) continue;
        const k = dayKey(slot.startTime, tz);
        if (byDay[k]) byDay[k].push({ type: t, coach, slot });
      }
    }
  });
  for (const k of keys) byDay[k].sort((a, b) => a.slot.startTime.localeCompare(b.slot.startTime));
  return { tz, days: keys, byDay, types };
}

/** The first day (from the list) that still has a class to book. */
export function firstOpenDay(t: Timetable): string {
  return t.days.find((k) => t.byDay[k].length > 0) || t.days[0];
}

/** Next open times per person for a booking type ("Today · 3:30 PM" chips). */
export async function nextTimesByHost(type: BookingType, opts: { from?: string; days?: number; max?: number } = {}): Promise<{ member: TeamMember; slots: Slot[]; firstDay?: string }[]> {
  const people = type.team.filter((m) => type.hosts.includes(m.email));
  const now = Date.now();
  const res = await Promise.all(people.map((m) => availability(type, { from: opts.from, days: opts.days || 7, host: m.email })));
  return people.map((member, i) => {
    const slots = (res[i]?.days || []).flatMap((d) => d.slots || []).filter((s) => s.spotsAvailable > 0 && Date.parse(s.startTime) > now).slice(0, opts.max || 6);
    return { member, slots, firstDay: slots[0]?.startTime };
  });
}
