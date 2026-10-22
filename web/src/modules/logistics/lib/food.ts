/**
 * Food orders for the Orders list, when the setup has Eat (the Store module, food
 * variant) on. Read from the customer's store orders (src/api/store.ts myOrders); each
 * one links to the Store module's tracking page /account/orders/[orderNumber].
 */
import "server-only";
import { myOrders } from "@/api/store";
import { kindOf } from "@/modules/store/lib/scope";

export interface FoodRow { id: string; orderNumber: string; title: string; when?: string; status: string; total?: number; currency?: string; items: number }

export async function getFoodOrders(): Promise<FoodRow[] | null> {
  try {
    // Only this setup's food orders: the org's other shops' orders come back from the same list.
    const all = await myOrders();
    const kinds = await Promise.all(all.map((o) => kindOf(o)));
    const list = all.filter((_, i) => kinds[i]?.kind === "food");
    return list.map((o) => {
      const d: any = o.raw || {};
      const shop = d?.vendor?.name || d?.storeName || d?.restaurant?.name || "";
      return {
        id: o.sk,
        orderNumber: o.orderNumber,
        title: shop || (o.lines[0]?.name ? String(o.lines[0].name) : `Order ${o.orderNumber}`),
        when: o.createdate,
        status: o.status,
        total: Number.isFinite(o.total) ? o.total : undefined,
        currency: o.currency,
        items: o.lines.reduce((s, it) => s + (Number(it.quantity) || 1), 0),
      };
    }).filter((x) => x.orderNumber);
  } catch {
    return null;
  }
}
