import Link from "next/link";
import type { Order } from "../lib/types";
import { money2 } from "../lib/money";

const LABEL: Record<string, string> = {
  new: "Placed", pending: "Placed", processing: "Preparing", "on-hold": "On hold", hold: "On hold", shipped: "Shipped", delivered: "Delivered",
  completed: "Completed", cancelled: "Cancelled", refunded: "Refunded", failed: "Payment failed", ready: "Ready",
};
export const orderLabel = (s: string) => LABEL[s] || s.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
export const orderTone = (s: string) => (["cancelled", "refunded", "failed"].includes(s) ? "off" : ["delivered", "completed"].includes(s) ? "done" : "live");
export const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

export function OrderPill({ status, label }: { status: string; label?: string }) {
  return <span className={`sf-pill ${orderTone(status)}`}>{label || orderLabel(status)}</span>;
}

/** One order in the list: thumbnails, number, date, status, total. */
export function OrderRow({ o, title, kind }: { o: Order; title?: string; kind?: "food" | "shop" }) {
  const n = o.lines.reduce((s, l) => s + l.quantity, 0);
  return (
    <Link className="sf-orow" href={`/account/orders/${encodeURIComponent(o.orderNumber)}`}>
      <span className="sf-orow-thumbs">
        {o.lines.slice(0, 3).map((l, i) => (l.image ? <img key={i} src={l.image} alt="" /> : <i key={i} />))}
      </span>
      <span className="sf-orow-main">
        <b>{title || o.lines[0]?.name || `Order #${o.orderNumber}`}</b>
        <small>{kind === "food" ? "Food · " : ""}#{o.orderNumber} · {fmtDate(o.createdate)} · {n} {n === 1 ? "item" : "items"}</small>
      </span>
      <OrderPill status={o.status} />
      <span className="sf-orow-amt">{money2(o.total, o.currency)}</span>
    </Link>
  );
}
