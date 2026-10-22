import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireSession } from "@/lib/guards";
import { CheckoutLoader } from "@/modules/rentals/components/checkout/checkout-loader";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  await requireSession(); // must be signed in to check out
  return (
    <>
      <SiteHeader />
      <CheckoutLoader />
      <SiteFooter />
    </>
  );
}
