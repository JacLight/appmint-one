import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { requireSession } from "@/lib/guards";
import { getSetup } from "@/lib/setup";
import { MODULES } from "@/setups/modules";
import { wordsFor } from "@/modules/logistics/lib/words";
import { TripView } from "@/modules/logistics/components/account/trip-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `Your ${wordsFor(await getSetup()).job.toLowerCase()}` };
}

/** The live trip screen: full-width map, the trip card over it. Owner only (the engine
 *  returns the job to its customer). */
export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ booked?: string }> }) {
  await requireSession();
  const [{ id }, sp, setup] = await Promise.all([params, searchParams, getSetup()]);
  return (
    <>
      <SiteHeader />
      <main className="mv-trip-main">
        <TripView id={id} words={wordsFor(setup)} backHref={MODULES.logistics.accountPath} booked={sp.booked === "1"} />
      </main>
    </>
  );
}
