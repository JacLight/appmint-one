import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/guards";
import { getSession } from "@/lib/auth";
import { getEventBooking, getMyEventTickets } from "@/modules/events/actions/events";

export const metadata: Metadata = { title: "Ticket orders" };

const money = (n: number | undefined) => (n == null || n === 0 ? "Free" : `$${Number(n).toFixed(2)}`);
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const label = (s: string) => s?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "";

/**
 * Order history. base-app has no events order list, so this is the one list built
 * here: the orders my tickets came from (`tickets/mine` → purchase.bookingId →
 * `booking`, which only answers the buyer). Each opens base-app's EventBookingViewer.
 * The engine has no "my orders" route, so an unpaid order or one whose tickets were all
 * transferred away isn't listed.
 */
export default async function TicketOrdersPage() {
  await requireSession();
  const email = (await getSession()).customer!.email;
  const tickets = await getMyEventTickets();
  const byBooking = new Map<string, any>();
  for (const t of tickets) { const id = t?.data?.purchase?.bookingId; if (id && !byBooking.has(id)) byBooking.set(id, t); }
  const orders = (await Promise.all([...byBooking.keys()].map((id) => getEventBooking(email, id))))
    .filter((r): r is NonNullable<typeof r> => !!r?.booking?.sk)
    .sort((a, b) => String(b.booking.createdate || "").localeCompare(String(a.booking.createdate || "")));

  return (
    <div className="max-w-3xl ev-tw">
      <h1 className="text-3xl font-bold text-[var(--text)] mb-2">Ticket orders</h1>
      <p className="text-[var(--muted)] mb-8">Every order with issued tickets, newest first.</p>
      {orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--muted)] font-medium">No orders yet</p>
          <Link href="/events" className="mt-4 inline-block text-sm text-[var(--primary)] hover:underline">Browse events</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(({ booking, tickets: bt }) => {
            const b = booking.data || {};
            const first = byBooking.get(String(booking.sk))?.data || {};
            return (
              <Link key={booking.sk} href={`/events/booking?bookingId=${encodeURIComponent(String(booking.sk))}&email=${encodeURIComponent(email)}`}
                className="flex items-center gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--text-2)] transition">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--text)] truncate">{first.eventName || "Event"}</h3>
                  <p className="text-sm text-[var(--muted)] mt-0.5">
                    {(b.productItems || []).map((i: any) => `${i.quantity} × ${i.name}`).join(", ") || `${bt.length} ticket${bt.length === 1 ? "" : "s"}`}
                  </p>
                  <p className="text-xs text-[var(--muted)] mt-1">Ref {b.bookingRef || booking.sk}{booking.createdate ? ` · placed ${day(booking.createdate)}` : ""}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-[var(--text)]">{money(b.total)}</p>
                  <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">{label(b.status)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
