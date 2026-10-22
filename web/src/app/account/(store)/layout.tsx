import { requireModule } from "@/lib/guards";

/** Store account routes (orders, returns, gift cards) — only where `store` is on. */
export default async function StoreAccountLayout({ children }: { children: React.ReactNode }) {
  await requireModule("store");
  return <>{children}</>;
}
