import Link from "next/link";
import { PageTitle } from "@/components/dashboard-shell";
import { EmptyState } from "@/components/empty-state";
import { requireSession } from "@/lib/guards";
import { routes } from "@/lib/nav";
import { stowbo } from "@/api/rentals";
import { formatMoney } from "@/lib/utils";
import { fmtFull, fmtDate, duration } from "@/lib/dates";
import { getMarket } from "@/modules/rentals/market/config";
import { MarketTrips } from "@/modules/rentals/market/market-trips";

export async function generateMetadata() {
  const m = await getMarket();
  return { title: m ? m.cfg.copy.tripsTitle : "Bookings" };
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed", active: "In storage", in_custody: "In storage",
  completed: "Completed", settled: "Completed", cancelled: "Cancelled", new: "Confirmed",
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireSession();
  // Stays / gear setups list their own trips; Stowbo continues below, unchanged.
  const market = await getMarket();
  if (market) return <MarketTrips m={market} tab={(await searchParams).tab} />;
  const res = await stowbo.myBookings().catch(() => null);
  const bookings = res?.data ?? [];

  return (
    <>
      <PageTitle title="Bookings" />
        {bookings.length === 0 ? (
          <EmptyState title="No bookings yet" note="When you reserve a spot, it shows up here with its drop-off and pickup codes." ctaLabel="Find a spot →" ctaHref={routes.browse} />
        ) : (
          <div className="bk-list">
            {bookings.map((b) => {
              const d: any = b.data;
              const items = (d?.items ?? []) as any[];
              const spaces = items.filter((it) => !it.kind || it.kind === "space");
              const titles = Array.from(new Set(spaces.map((s) => s.listingTitle).filter(Boolean)));
              const primary = titles[0] || "Your booking";
              const more = titles.length - 1;
              const starts = spaces.map((s) => s.startDate).filter(Boolean).sort();
              const ends = spaces.map((s) => s.endDate).filter(Boolean).sort();
              const start = starts[0], end = ends[ends.length - 1];
              const status = String(d?.status ?? "confirmed");
              const cancelled = status === "cancelled";
              const dur = duration(start, end);
              return (
                <Link key={b.sk} href={`${routes.account}/bookings/${b.sk}`} className={`bk-card${cancelled ? " off" : ""}`}>
                  <div className="bk-top">
                    <div className="bk-head">
                      <b className="bk-title">{primary}{more > 0 ? <span className="bk-more"> + {more} more space{more > 1 ? "s" : ""}</span> : null}</b>
                      <div className="bk-when">{fmtFull(start)}{end ? <> <span className="bk-arrow">→</span> {fmtFull(end)}</> : null}{dur ? <span className="bk-dur"> · {dur}</span> : null}</div>
                    </div>
                    <div className="bk-right">
                      <b className="bk-total">{formatMoney((d?.total ?? 0) * 100, d?.currency)}</b>
                      <span className={`bk-status s-${status}`}>{STATUS_LABEL[status] || status}</span>
                    </div>
                  </div>
                  <div className="bk-meta">
                    <span>Ref #{d?.name}</span>
                    {b.createdate ? <span>Booked {fmtDate(b.createdate)}</span> : null}
                    <span className="bk-view">View details →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </>
  );
}
