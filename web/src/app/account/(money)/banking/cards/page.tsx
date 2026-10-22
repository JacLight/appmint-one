import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { bankingMode, load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { CardControls } from "@/modules/money/components/card-controls";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const setup = await getSetup();
  const [cards, accounts] = await Promise.all([load((b) => b.listCards()), load((b) => b.listAccounts())]);
  return (
    <>
      <BankHead title="Cards" sub="Freeze a card in a tap and set how much it can spend each day." />
      {!cards.ok ? <ErrorPanel error={cards.error} /> : cards.data.length === 0 ? (
        <div className="mn-empty"><b>No cards yet</b><p>Your debit card shows up here as soon as it’s issued.</p></div>
      ) : (
        <CardControls cards={cards.data} accounts={accounts.ok ? accounts.data.items : []} brand={setup.brand.name} sample={bankingMode() === "sample"} />
      )}
    </>
  );
}
