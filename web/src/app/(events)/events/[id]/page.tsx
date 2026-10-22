import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSession } from "@/lib/auth";
import { getEventDetail } from "@/modules/events/actions/events";
import { EventDetail } from "@/modules/events/base/EventDetail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getEventDetail((await params).id);
  const e = d?.event?.data;
  return e ? { title: e.title || e.name, description: e.shortDescription } : { title: "Event" };
}

/** Event page + buy: base-app's EventDetail (ticket panel → purchase → EventCheckout). */
export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const [d, session] = await Promise.all([getEventDetail(id), getSession()]);
  if (!d?.event?.sk) notFound();
  const c = session.customer;
  return (
    <>
      <SiteHeader />
      <main className="wrap ev-page ev-tw">
        <EventDetail event={d.event} eventId={String(d.event.sk)} slug="events"
          defaultEmail={c?.email} defaultName={[c?.firstName, c?.lastName].filter(Boolean).join(" ")} />
      </main>
      <SiteFooter />
    </>
  );
}
