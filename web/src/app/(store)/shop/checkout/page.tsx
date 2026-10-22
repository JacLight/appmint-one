import type { Metadata } from "next";
import Link from "next/link";
import { paymentGateways } from "@/api/store";
import { getSetup } from "@/lib/setup";
import { checkoutUser } from "@/modules/store/shell";
import { Icon } from "@/modules/store/components/icons";
import { Checkout } from "@/modules/store/components/storefront/Checkout";

const OFFERED = ["StripeProvider", "GiftCardProvider", "OfflineProvider"];

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/** base-app app/checkout/page.tsx: the store's payment gateways, then its Checkout.
 *  Appmint One: no site navigation here — the brand, "secure checkout" and the way back. */
export default async function CheckoutPage() {
  const [gateways, userData, setup] = await Promise.all([paymentGateways().catch(() => []), checkoutUser(), getSetup()]);
  const list: any[] = Array.isArray(gateways) ? gateways : (gateways as any)?.data || [];
  // Only the gateways this app carries (base-app's PayPal / PayOxygen SDKs are not installed here).
  const offered = list.filter((g) => OFFERED.includes(g?.data?.provider));
  return (
    <>
      <header className="sf-co-brand">
        <Link href="/">{setup.brand.name}</Link>
        <span><Icon name="lock" size={15} />Secure checkout</span>
      </header>
      <Checkout paymentGateways={offered} storePage="shop" userData={userData} />
    </>
  );
}
