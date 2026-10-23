import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { usesEngineBanking, load } from "@/modules/money/api/adapter";
import { BankHead, ErrorPanel } from "@/modules/money/components/bits";
import { BankRequestDetail } from "@/modules/money/components/bank-domain-panels";
export const metadata: Metadata = { title: "Bank money request" };
export default async function BankRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  if (!usesEngineBanking()) notFound();
  const [{ id }, query, accounts] = await Promise.all([params, searchParams, load(b => b.listAccounts())]);
  if (!/^[a-f0-9]{24}$/i.test(id)) notFound();
  return <><BankHead title="Bank money request" back={{ href: "/account/banking/request", label: "Your requests" }} />{accounts.ok ? <BankRequestDetail requestId={id} shareToken={query.token} accounts={accounts.data.items} /> : <ErrorPanel error={accounts.error} />}</>;
}
