import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { EatFeed, type SP } from "@/modules/store/components/eat-feed";

export const metadata: Metadata = { title: "Food delivery", description: "Order from local restaurants and follow your food to the door." };

export default async function EatPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="ea-feed"><EatFeed sp={sp} /></main>
      <SiteFooter />
    </>
  );
}
