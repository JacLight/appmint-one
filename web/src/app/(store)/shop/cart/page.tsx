import type { Metadata } from "next";
import CatalogPage from "../page";
import { OpenCart } from "@/modules/store/components/shop-bag";

export const metadata: Metadata = { title: "Your bag", robots: { index: false } };
type SP = Record<string, string | string[] | undefined>;

/** The bag is base-app's cart drawer; /shop/cart opens it over the shop. */
export default function CartPage({ searchParams }: { searchParams: Promise<SP> }) {
  return <><CatalogPage searchParams={searchParams} /><OpenCart /></>;
}
