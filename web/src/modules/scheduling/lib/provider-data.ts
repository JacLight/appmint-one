import "server-only";
import { availability, bookingTypes } from "./data";
import type { BookingType, ProviderSlot } from "./types";

/**
 * The provider's own calendar, from what the reservations API gives a host who signs in
 * here (a customer account): the public availability of the booking types they host.
 * A group class shows how many of its places are taken (capacity − open); a one-to-one
 * type, asked for with the provider as host, shows each of their times that is taken.
 * Who booked is not readable this way: the engine's hosted-bookings list
 * (GET crm/reservations/mine) is for staff sign-ins only.
 */
export async function myTypes(email: string): Promise<BookingType[]> {
  const e = email.trim().toLowerCase();
  return (await bookingTypes()).filter((t) => t.hosts.includes(e) && !t.hidden);
}

export async function myTimes(email: string, from: string, days: number): Promise<ProviderSlot[] | null> {
  const e = email.trim().toLowerCase();
  const types = await myTypes(e);
  const res = await Promise.all(types.map((t) => availability(t, { from, days, host: t.kind === "class" ? undefined : e })));
  if (types.length && res.every((r) => r === null)) return null;
  const out: ProviderSlot[] = [];
  // Asked with a host, a slot is taken when that person has ANY booking then, so the same
  // taken time shows on each of their one-to-one types: keep it once.
  const oneToOne = new Set<string>();
  types.forEach((type, i) => {
    for (const d of res[i]?.days || []) {
      if (d.closed || (d as any).hostOnLeave) continue;
      for (const s of d.slots || []) {
        const booked = Math.max(0, (s.spotsTotal || 0) - (s.spotsAvailable || 0));
        if (booked <= 0) continue;
        if (type.kind !== "class") {
          if (oneToOne.has(s.startTime)) continue;
          oneToOne.add(s.startTime);
        }
        out.push({ type, startTime: s.startTime, endTime: s.endTime, capacity: s.spotsTotal, booked, shared: type.kind !== "class" && types.filter((t) => t.kind !== "class").length > 1 });
      }
    }
  });
  return out.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
