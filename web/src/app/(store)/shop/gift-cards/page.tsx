import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireRetail } from "@/modules/store/lib/guard";
import { listProducts } from "@/api/store";

export const metadata: Metadata = { title: "Gift cards" };

/** Gift cards are a product (giftCard.enabled): base-app's product page sells them. */
export default async function GiftCardsPage() {
  const view = await requireRetail();
  const card = await listProducts({ tags: view.tags, pageSize: 200 }).then((r) => r.products.find((p) => p.data.giftCard?.enabled)).catch(() => undefined);
  if (card) redirect(`/shop/${encodeURIComponent(card.data.slug || card.data.sku)}`);
  return (
    <>
      <SiteHeader />
      <main className="sf-wrap sf-page">
        <div className="sf-empty big"><h3>Gift cards aren’t on sale yet</h3><p>Check back soon, or see what’s in the shop.</p><Link className="sf-btn lg" href="/shop">Shop all</Link></div>
      </main>
      <SiteFooter />
    </>
  );
}
