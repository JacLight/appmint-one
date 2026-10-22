import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EventList } from "./base/EventList";

/** Event Oxygen's home is the event list (base-app's EventList). */
export async function EventsHome() {
  return (
    <>
      <SiteHeader />
      <main className="wrap ev-page ev-tw"><EventList slug="events" /></main>
      <SiteFooter />
    </>
  );
}
