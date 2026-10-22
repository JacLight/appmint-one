import type { Metadata } from "next";
import { requireSession } from "@/lib/guards";
import { StoreShell } from "@/modules/store/shell";
import { GiftCards } from "@/modules/store/components/my-account/GiftCards";

export const metadata: Metadata = { title: "Gift cards" };

export default async function GiftCardsPage() {
  await requireSession();
  return <StoreShell><GiftCards /></StoreShell>;
}
