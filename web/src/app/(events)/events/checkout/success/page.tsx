import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EventCheckoutSuccess } from "@/modules/events/base/EventCheckoutSuccess";

export const metadata = { title: "Order confirmed", robots: { index: false } };

/** Stripe's return_url after EventCheckout: confirms the order and issues the tickets. */
export default function CheckoutSuccessPage() {
  return (
    <>
      <SiteHeader />
      <main className="wrap ev-page ev-tw"><Suspense><EventCheckoutSuccess eventsPage="events" /></Suspense></main>
      <SiteFooter />
    </>
  );
}
