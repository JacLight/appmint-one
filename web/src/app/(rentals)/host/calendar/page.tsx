import { requireHost } from "@/lib/guards";
import { requireMarket } from "@/modules/rentals/market/config";
import { MarketHostCalendar } from "@/modules/rentals/market/market-host";

export const metadata = { title: "Calendar" };

/** Stays / gear: month calendar per listing — who's booked, block and unblock dates. */
export default async function HostCalendarPage({ searchParams }: { searchParams: Promise<{ listing?: string; m?: string }> }) {
  const m = await requireMarket();
  await requireHost();
  const sp = await searchParams;
  return <MarketHostCalendar m={m} listing={sp.listing} month={sp.m} />;
}
