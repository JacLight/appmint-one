import type { Metadata } from "next";
import { load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { IdentityCenter } from "@/modules/money/components/identity-center";

export const metadata: Metadata = { title: "Identity verification" };

/** The customer's identity check: where it is, what's missing, their details and ID photos. */
export default async function IdentityPage() {
  const res = await load((b) => b.identity());
  return (
    <>
      <BankHead title="Identity verification" sub="The bank confirms who you are before an account opens. It takes about five minutes." />
      {res.ok ? <IdentityCenter initial={res.data} support="/account/support" /> : <ErrorPanel error={res.error} title="We couldn’t load your verification" />}
    </>
  );
}
