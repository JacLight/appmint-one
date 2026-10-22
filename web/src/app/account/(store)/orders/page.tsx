import type { Metadata } from "next";
import { requireSession } from "@/lib/guards";
import { myOrders } from "@/api/store";
import { kindOf } from "@/modules/store/lib/scope";
import { StoreShell } from "@/modules/store/shell";
import { Orders } from "@/modules/store/components/my-account/Orders";

export const metadata: Metadata = { title: "Orders" };

/** base-app my-account Orders, inside the account shell: this setup's orders only. */
export default async function OrdersPage() {
  await requireSession();
  const all = await myOrders().catch(() => []);
  const mine = (await Promise.all(all.map(async (o) => ((await kindOf(o)) ? o : null)))).filter(Boolean) as typeof all;
  const orders = mine.map((o) => ({ sk: o.sk, createdate: o.createdate, data: o.raw }));
  return <StoreShell><Orders data={{ orders } as any} /></StoreShell>;
}
