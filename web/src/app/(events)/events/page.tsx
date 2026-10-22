import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { moduleLabel } from "@/setups/modules";
import { EventList } from "@/modules/events/base/EventList";

export async function generateMetadata(): Promise<Metadata> {
  const setup = await getSetup();
  return { title: moduleLabel(setup, "events"), description: setup.moduleCopy?.events?.blurb };
}

/** Browse: base-app's EventList. */
export default function EventsPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap ev-page ev-tw"><EventList slug="events" /></main>
      <SiteFooter />
    </>
  );
}
