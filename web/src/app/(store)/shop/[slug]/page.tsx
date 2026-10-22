import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { requireRetail } from "@/modules/store/lib/guard";
import { getProduct, relatedProducts } from "@/api/store";
import ProductDetail from "@/modules/store/components/storefront/boutique/ProductDetail";

type Params = { params: Promise<{ slug: string }> };

/** This setup's products only (its catalog tags), as the live /shop/[slug] page. */
async function load(slug: string) {
  const view = await requireRetail();
  const p = await getProduct(decodeURIComponent(slug));
  return p && (p.post?.tags || []).some((t) => view.tags.includes(t)) ? { view, p } : { view, p: null };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { p } = await load((await params).slug);
  return p ? { title: p.data.name, description: p.data.description } : { title: "Not found" };
}

/** base-app StorefrontRoute's product branch: the product, its related products, ProductDetail. */
export default async function ProductPage({ params }: Params) {
  const { view, p } = await load((await params).slug);
  if (!p) notFound();
  const related = await relatedProducts(p.data.sku, view.tags, 4).catch(() => []);
  return (
    <>
      <SiteHeader />
      <ProductDetail product={p as any} site={{ data: { storefront: {} } }} config={{ perks: view.perks }} slug="shop" relatedProducts={related as any[]} />
      <SiteFooter />
    </>
  );
}
