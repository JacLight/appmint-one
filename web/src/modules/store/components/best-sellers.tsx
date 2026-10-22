"use client";

import { useState } from "react";
import type { StoreCategory } from "@/setups/store-config";
import type { Product } from "../lib/types";
import { ProductCard } from "./product-card";

/** Best sellers with department tabs — a row that scrolls sideways on phones. */
export function BestSellers({ products, categories }: { products: Product[]; categories: StoreCategory[] }) {
  const tabs = [{ slug: "", label: "All" }, ...categories.filter((c) => products.some((p) => p.post?.categories?.includes(c.slug)))];
  const [tab, setTab] = useState("");
  const list = (tab ? products.filter((p) => p.post?.categories?.includes(tab)) : products).slice(0, 8);
  return (
    <>
      {tabs.length > 2 && (
        <div className="sf-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.slug} role="tab" aria-selected={tab === t.slug} className={tab === t.slug ? "on" : ""} onClick={() => setTab(t.slug)}>{t.label}</button>
          ))}
        </div>
      )}
      <div className="sf-rail">
        {list.map((p, i) => <ProductCard key={p.sk} p={p} priority={i < 4} />)}
      </div>
    </>
  );
}
