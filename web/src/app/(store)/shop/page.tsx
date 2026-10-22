import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getSetup } from "@/lib/setup";
import { requireRetail } from "@/modules/store/lib/guard";
import { listProducts } from "@/api/store";
import ProductList from "@/modules/store/components/storefront/boutique/ProductList";

export const metadata: Metadata = { title: "Shop" };
type SP = Record<string, string | string[] | undefined>;

/** base-app StorefrontRoute's catalog branch: this setup's products, then ProductList
 *  (its filters re-query through the product-service action, scoped the same way).
 *  Appmint One: a collection header (the department's name and photo from the setup),
 *  the department pills, then the list. */
export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [view, sp, setup] = await Promise.all([requireRetail(), searchParams, getSetup()]);
  const category = typeof sp.category === "string" ? sp.category : undefined;
  // Appmint One: ?q= is a word search (the home's materials link here: ?q=walnut).
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : undefined;
  const { products, total } = await listProducts({ tags: view.tags, category, keyword: q, pageSize: 26 }).catch(() => ({ products: [], total: 0 }));
  const dept = category ? view.categories.find((c) => c.slug === category) : undefined;
  const mat = q ? view.materials?.find((m) => m.keyword.toLowerCase() === q.toLowerCase()) : undefined;
  const title = mat?.label || (q ? `“${q}”` : "") || dept?.label || category || "Shop all";
  const image = mat?.image || (dept ? dept.image : q ? undefined : view.hero?.image);
  const blurb = dept || q ? `${total} ${total === 1 ? "piece" : "pieces"}${mat ? ` in ${mat.label.toLowerCase()}` : q ? " match" : ""}` : setup.brand.description;
  // Room photos between the rows: on a department page only that department's rooms.
  const inserts = (view.rooms || [])
    .filter((r) => !q && (!category || r.href === `/shop?category=${encodeURIComponent(category)}`))
    .map((r) => ({ label: r.label, image: r.image, href: r.href }));
  return (
    <>
      <SiteHeader />
      <main className="sf-plp">
        <header className={`sf-plp-hd${image ? "" : " noimg"}`}>
          <div>
            <nav className="sf-crumbs" aria-label="Breadcrumb">
              <Link href="/">Home</Link><span aria-hidden="true">/</span>
              {dept || q ? <><Link href="/shop">Shop</Link><span aria-hidden="true">/</span><span className="here">{title}</span></> : <span className="here">Shop</span>}
            </nav>
            <h1>{title}</h1>
            {blurb && <p>{blurb}</p>}
          </div>
          {image && <figure className="sf-plp-hd-img"><img src={image} alt="" /></figure>}
        </header>

        {view.categories.length > 0 && (
          <nav className="sf-plp-cats" aria-label="Departments">
            <Link href="/shop" className={`noimg${!category && !q ? " on" : ""}`} aria-current={!category && !q ? "page" : undefined}>All</Link>
            {view.categories.map((c) => (
              <Link key={c.slug} href={`/shop?category=${encodeURIComponent(c.slug)}`} className={`${c.image ? "" : "noimg"}${c.slug === category ? " on" : ""}`} aria-current={c.slug === category ? "page" : undefined}>
                {c.image && <img src={c.image} alt="" />}{c.label}
              </Link>
            ))}
          </nav>
        )}

        <ProductList
          key={`${category || "all"}|${q || ""}`}
          productDTO={{ data: products, total, hasNext: total > products.length, pageSize: 26 }}
          slug="shop"
          searchParams={sp}
          categories={view.categories.map((c) => ({ slug: c.slug, name: c.label, title: c.label }))}
          brands={[]}
          filters={[]}
          siteOrgId={new URLSearchParams({ ...(category ? { category } : {}), ...(q ? { keyword: q } : {}) }).toString()}
          config={{ inserts }}
          site={{ data: { storefront: {} } }}
          quickView="none"
          filterLayout="none"
        />
      </main>
      <SiteFooter />
    </>
  );
}
