import { requireHost } from "@/lib/guards";
import { requireMarket } from "@/modules/rentals/market/config";
import { MarketPayouts } from "@/modules/rentals/market/market-host";

export const metadata = { title: "Payouts" };

/** Stays / gear: the host wallet — available balance, cash out, payout methods, history. */
export default async function PayoutsPage() {
  const m = await requireMarket();
  await requireHost();
  return <MarketPayouts m={m} />;
}
