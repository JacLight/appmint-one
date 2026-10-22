import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { DashboardShell } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { requireHost } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { getNav } from "@/lib/nav-server";
import { stowbo } from "@/api/rentals";
import { fmtFull, fmtDate } from "@/lib/dates";
import { bookingStage } from "@/modules/rentals/lib/custody";

export const metadata = { title: "Custody" };

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Awaiting drop-off", active: "In custody", completed: "Collected",
  requested: "New request", settled: "Settled", cancelled: "Cancelled", new: "Awaiting drop-off",
};

export default async function HostCustody() {
  await requireHost();

  // The operator board: every booking that touches one of the host's listings,
  // newest-active first, each opening the custody console. Built from endpoints
  // that exist (listings → their bookings); degrades to empty on any hiccup.
  let bookings: any[] = [];
  try {
    const listingsRes = await stowbo.host.listings().catch(() => null);
    const listings = (listingsRes?.data ?? []) as any[];
    const arrays = await Promise.all(listings.map((l) => stowbo.host.listingBookings(String(l.sk)).catch(() => [] as any[])));
    const seen = new Set<string>();
    for (const b of arrays.flat()) {
      const sk = String((b as any)?.sk || "");
      const status = String((b as any)?.data?.status || "");
      if (sk && !seen.has(sk) && status !== "cancelled" && status !== "settled") { seen.add(sk); bookings.push(b); }
    }
    // Invoice status stays "new" during custody; derive the operational state
    // from the same per-item records used by the booking console.
    bookings = await Promise.all(bookings.map(async (b) => {
      const items = await stowbo.host.bookingItems(String(b.sk)).catch(() => null);
      if (!items) return b;
      const stage = bookingStage(String(b.data?.status || ""), items.map((i) => i.data));
      const status = stage.index === 2 ? "completed" : stage.index === 1 ? "active" : b.data?.status;
      return { ...b, data: { ...b.data, status } };
    }));
    // Awaiting → in-custody → collected, then newest first.
    const rank = (s: string) => (s === "confirmed" || s === "new" ? 0 : s === "active" ? 1 : 2);
    bookings.sort((a, b) => rank(a.data?.status) - rank(b.data?.status) || String(b.createdate || "").localeCompare(String(a.createdate || "")));
  } catch { bookings = []; }

  return (
    <>
      <SiteHeader />
      <DashboardShell nav={(await getNav()).provider} title="Custody">
        {bookings.length === 0 ? (
          <EmptyState title="Nothing in custody yet" note="When a guest books one of your spaces it shows up here — check them in on arrival, then hand back and settle when they collect." />
        ) : (
          <div className="bk-list">
            {bookings.map((b) => {
              const d = b.data ?? {};
              const items = (d.items ?? []).filter((it: any) => !it.kind || it.kind === "space");
              const title = items[0]?.listingTitle || "Booking";
              const start = items.map((i: any) => i.startDate).filter(Boolean).sort()[0];
              const end = items.map((i: any) => i.endDate).filter(Boolean).sort().slice(-1)[0];
              const status = String(d.status || "confirmed");
              return (
                <Link key={b.sk} href={`${routes.hostCustody}/${b.sk}`} className="bk-card">
                  <div className="bk-top">
                    <div className="bk-head">
                      <b className="bk-title">{title}</b>
                      <div className="bk-when">{fmtFull(start)}{end ? <> <span className="bk-arrow">→</span> {fmtFull(end)}</> : null}</div>
                    </div>
                    <span className={`bk-status s-${status}`}>{STATUS_LABEL[status] || status}</span>
                  </div>
                  <div className="bk-meta">
                    <span>Ref #{d.name}</span>
                    <span>{d.customerName || d.customer || "Guest"}</span>
                    {b.createdate ? <span>Booked {fmtDate(b.createdate)}</span> : null}
                    <span className="bk-view">Open console →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </DashboardShell>
    </>
  );
}
