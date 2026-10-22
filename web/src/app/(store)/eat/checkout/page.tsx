import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSession } from "@/lib/auth";
import { requireFood } from "@/modules/store/lib/guard";
import { getRestaurant } from "@/api/store";
import { currentCart } from "@/modules/store/lib/cart-cookie";
import { deliveryAddress, deliveryFee, etaRange } from "@/modules/store/lib/food";
import { FoodCheckout } from "@/modules/store/components/food-checkout";
import { EatAddress } from "@/modules/store/components/eat-address";
import { Icon } from "@/modules/store/components/icons";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function EatCheckoutPage() {
  const view = await requireFood();
  const session = await getSession();
  if (!session.signedIn) redirect("/login?next=/eat/checkout");
  const cart = await currentCart("food").catch(() => null);
  const r = cart?.restaurant ? await getRestaurant(view.foodTag, cart.restaurant) : null;
  const saved = await deliveryAddress();
  const address = saved || view.defaultAddress?.address;
  const fee = r && address ? await deliveryFee(r, address) : null;

  return (
    <>
      <SiteHeader />
      <main className="ea-wrap ea-co-page">
        <h1 className="sf-h1">Checkout</h1>
        {!cart?.lines.length || !r ? (
          <div className="sf-empty big"><Icon name="bag" size={40} /><h3>Your basket is empty</h3><p>Pick a restaurant and add something to start an order.</p><Link className="ea-btn" href="/eat">Find food</Link></div>
        ) : !address ? (
          <div className="ea-co-card"><h2>Where should we deliver?</h2><EatAddress /></div>
        ) : !fee?.ok ? (
          <div className="ea-co-card"><h2>Delivery</h2><p className="sf-err">{fee?.error || "We couldn’t price delivery."}</p><EatAddress address={address} /></div>
        ) : (
          <FoodCheckout cart={cart} restaurant={{ title: r.title, image: r.image, street: r.street }} address={fee.quote.dropoffAddress || address}
            addressLabel={saved ? undefined : view.defaultAddress?.label} fee={fee.quote.amount}
            total={Math.round((cart.totals.total + fee.quote.amount) * 100) / 100} eta={etaRange(r, fee.quote)} />
        )}
      </main>
    </>
  );
}
