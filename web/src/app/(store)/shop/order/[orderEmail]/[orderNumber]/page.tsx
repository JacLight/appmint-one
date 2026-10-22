import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { Icon } from "@/modules/store/components/icons";
import { OrderConfirmation } from "@/modules/store/components/storefront/OrderConfirmation";

export const metadata = { title: "Your order", robots: { index: false } };

/** Appmint One: the receipt keeps checkout's frame — the brand and the way back, no site navigation. */
export default async function OrderPage() {
  const setup = await getSetup();
  return (
    <>
      <header className="sf-co-brand">
        <Link href="/">{setup.brand.name}</Link>
        <Link href="/shop" className="bag"><Icon name="bag" size={17} />Shop</Link>
      </header>
      <OrderConfirmation site={{ data: { storefront: { storePage: "shop" } } }} />
    </>
  );
}
