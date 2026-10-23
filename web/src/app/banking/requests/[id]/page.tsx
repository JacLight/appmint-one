import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { requireModule } from "@/lib/guards";
import { usesEngineBanking } from "@/modules/money/api/adapter";
export const metadata: Metadata = { title: "Bank money request", robots: { index: false, follow: false } };
/** Keep the capability on this page while existing sign-in opens separately; no auth-flow changes. */
export default async function SharedBankRequest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  await requireModule("money");
  if (!usesEngineBanking()) notFound();
  const [{ id }, query, session] = await Promise.all([params, searchParams, getSession()]);
  if (!/^[a-f0-9]{24}$/i.test(id) || (query.token !== undefined && !/^[\w-]{43}$/.test(query.token))) notFound();
  const tail = `${id}${query.token ? `?token=${encodeURIComponent(query.token)}` : ""}`;
  if (session.signedIn) redirect(`/account/banking/requests/${tail}`);
  return <main className="mx-auto max-w-xl space-y-5 px-6 py-16"><h1 className="text-3xl font-semibold">Bank money request</h1><p>Only a signed-in member of this bank can review and pay a request. No request details are shown before sign-in.</p><p>Sign in in another tab, then return here and open the request. This page keeps the original private link.</p><p><a className="underline" href="/login" target="_blank" rel="noopener noreferrer">Sign in in another tab</a></p><p><a className="underline" href={`/banking/requests/${tail}`}>Open request after sign-in</a></p></main>;
}
