import { requireHost } from "@/lib/guards";
import { requireMarket } from "@/modules/rentals/market/config";
import { MarketReservations } from "@/modules/rentals/market/market-host";

export const metadata = { title: "Reservations" };

/** Stays / gear: reservations on the host's listings (GET client/stowbo/host/bookings). */
export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const m = await requireMarket();
  await requireHost();
  return <MarketReservations m={m} tab={(await searchParams).tab} />;
}
