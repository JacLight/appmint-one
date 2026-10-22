import type { Metadata } from "next";
import { requireSession } from "@/lib/guards";
import { StoreShell } from "@/modules/store/shell";
import { Returns } from "@/modules/store/components/my-account/Returns";

export const metadata: Metadata = { title: "Returns" };

export default async function ReturnsPage() {
  await requireSession();
  return <StoreShell><Returns /></StoreShell>;
}
