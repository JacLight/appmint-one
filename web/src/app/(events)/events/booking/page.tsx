import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EventBookingViewer } from "@/modules/events/base/EventBookingViewer";

export const metadata = { title: "Your booking", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** An order and its tickets by email + booking id: base-app's EventBookingViewer. */
export default async function BookingPage({ searchParams }: Props) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  return (
    <>
      <SiteHeader />
      <main className="wrap ev-page ev-tw"><EventBookingViewer email={s("email")} bookingId={s("bookingId")} slug="events" /></main>
      <SiteFooter />
    </>
  );
}
