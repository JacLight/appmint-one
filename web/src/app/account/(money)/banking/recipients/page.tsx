import type { Metadata } from "next";
import { getSetup } from "@/lib/setup";
import { bankingMode, load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { RecipientsManager } from "@/modules/money/components/recipients-manager";

export const metadata: Metadata = { title: "Recipients" };

export default async function RecipientsPage() {
  const setup = await getSetup();
  const res = await load((b) => b.listRecipients());
  return (
    <>
      <BankHead title="Recipients" sub="People and accounts you pay. New bank recipients need a security code before they’re saved." />
      {res.ok ? <RecipientsManager recipients={res.data} bank={setup.brand.name} sample={bankingMode() === "sample"} /> : <ErrorPanel error={res.error} />}
    </>
  );
}
