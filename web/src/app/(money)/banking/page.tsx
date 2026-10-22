import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSetup } from "@/lib/setup";
import { BankHome } from "@/modules/money/components/home/bank-home";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSetup();
  return { title: "Personal banking", description: s.brand.description };
}

/** /banking: signed in → the banking home; signed out → the bank's front page. */
export default async function BankingPublicPage() {
  if ((await getSession()).signedIn) redirect("/account/banking/home");
  return <BankHome />;
}
