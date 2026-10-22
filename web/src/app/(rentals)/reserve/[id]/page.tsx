import { MarketBook } from "@/modules/rentals/market/market-book";

export const metadata = { title: "Confirm and pay" };

/** Stays / gear checkout for one listing (Stowbo setups have no such route → 404). */
export default async function ReservePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  return <MarketBook id={id} sp={await searchParams} />;
}
