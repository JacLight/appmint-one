import Link from "next/link";
import type { BankError, Card, Money, Transaction, TxStatus } from "../api/types";
import { CATEGORY_TINT, fmt, initials, splitMoney } from "../lib/format";
import { Icon, type IconName } from "./icons";

/** Big balance with the cents set smaller. */
export function Balance({ value, className = "" }: { value: Money | number; className?: string }) {
  const { whole, cents } = splitMoney(value);
  return <span className={`mn-bal ${className}`}>{whole}<small>{cents}</small></span>;
}

/** Signed amount: money in is green with a plus, money out is plain with a minus. */
export function Signed({ t, strong }: { t: Pick<Transaction, "direction" | "amount" | "status">; strong?: boolean }) {
  const cls = `mn-amt ${t.direction === "credit" ? "in" : "out"}${t.status === "pending" ? " pend" : ""}${t.status === "canceled" || t.status === "returned" ? " void" : ""}`;
  const text = fmt(t.amount, { sign: t.direction === "credit" ? "credit" : "debit" });
  return strong ? <b className={cls}>{text}</b> : <span className={cls}>{text}</span>;
}

const KIND_ICON: Partial<Record<Transaction["kind"], IconName>> = {
  own: "swap", interest: "piggy", fee: "info", atm: "bank", deposit: "bank",
};

/** Merchant / person avatar: logo when the API has one, initials on a category tint otherwise. */
export function TxAvatar({ t, size = 40 }: { t: Transaction; size?: number }) {
  const style = { width: size, height: size, background: CATEGORY_TINT[t.category] } as React.CSSProperties;
  if (t.counterparty?.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <span className="mn-av" style={style}><img src={t.counterparty.logoUrl} alt="" /></span>;
  }
  const icon = KIND_ICON[t.kind];
  return (
    <span className={`mn-av${t.counterparty?.type === "person" || t.counterparty?.type === "bank_account" ? " person" : ""}`} style={style} aria-hidden>
      {icon ? <Icon name={icon} size={Math.round(size * 0.45)} /> : initials(t.counterparty?.name || t.description)}
    </span>
  );
}

export function PersonAvatar({ name, size = 40, tone = 0 }: { name: string; size?: number; tone?: number }) {
  const tints = ["#e3ecf7", "#fbe9dc", "#e8f4dc", "#efe6f8", "#dff0f7", "#f6e1ef"];
  const i = (name.charCodeAt(0) + name.length + tone) % tints.length;
  return <span className="mn-av person" style={{ width: size, height: size, background: tints[i], fontSize: Math.round(size * 0.36) }} aria-hidden>{initials(name)}</span>;
}

export function StatusChip({ status }: { status: TxStatus | string }) {
  const label: Record<string, string> = {
    pending: "Pending", posted: "Posted", returned: "Returned", canceled: "Canceled", completed: "Completed", processing: "Processing",
    scheduled: "Scheduled", failed: "Failed", open: "Open", paid: "Paid", declined: "Declined", expired: "Expired",
    active: "Active", frozen: "Frozen", inactive: "Not activated", closed: "Closed",
  };
  return <span className={`mn-chip s-${status}`}>{label[status] || status}</span>;
}

/** Sample-mode banner, shown on every Money screen while the API isn't connected. */
export function SampleBanner() {
  return (
    <div className="mn-sample" role="note">
      <Icon name="info" size={16} />
      <span><b>Sample data — banking API not connected.</b><span className="mn-sample-more"> Nothing you do here moves real money.</span></span>
    </div>
  );
}

/** Production with no banking API: the honest empty screen. */
export function NotAvailable({ brand }: { brand: string }) {
  return (
    <div className="mn-na">
      <span className="mn-na-ic"><Icon name="bank" size={28} /></span>
      <h2>Not available yet</h2>
      <p>Online banking for {brand} is being connected. Your accounts, transfers and cards will appear here as soon as it’s ready.</p>
      <div className="mn-na-acts">
        <Link className="btn clay sm" href="/account/messages">Message us</Link>
        <Link className="btn ghost sm" href="/account/support">Support</Link>
      </div>
    </div>
  );
}

export function ErrorPanel({ error, title = "We couldn’t load this" }: { error: Pick<BankError, "message" | "code">; title?: string }) {
  return (
    <div className="mn-err" role="alert">
      <Icon name="alert" size={22} />
      <div><b>{error.code === "NOT_FOUND" ? "Not found" : title}</b><p>{error.message}</p></div>
    </div>
  );
}

/** Balance sparkline from the API's daily balances. Display only. */
export function Sparkline({ points, height = 84, className = "" }: { points: { date: string; balance: number }[]; height?: number; className?: string }) {
  if (!points || points.length < 2) return null;
  const w = 600;
  const vals = points.map((p) => p.balance);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * w, 6 + (1 - (v - min) / span) * (height - 12)] as const);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const area = `${line}L${w},${height}L0,${height}Z`;
  return (
    <svg className={`mn-spark ${className}`} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="mnSparkFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--primary)" stopOpacity=".18" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mnSparkFill)" />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A rendered debit card. */
export function CardArt({ card, brand, small }: { card: Pick<Card, "last4" | "nameOnCard" | "expMonth" | "expYear" | "status" | "form" | "network">; brand: string; small?: boolean }) {
  return (
    <div className={`mn-cardart${card.form === "virtual" ? " virtual" : ""}${card.status === "frozen" ? " frozen" : ""}${small ? " small" : ""}`}>
      <div className="mn-ca-top">
        <span className="mn-ca-brand">{brand}</span>
        <span className="mn-ca-form">{card.form === "virtual" ? "Virtual" : "Debit"}</span>
      </div>
      {!small && <span className="mn-ca-chip" aria-hidden />}
      <div className="mn-ca-num">•••• {card.last4}</div>
      <div className="mn-ca-bot">
        {!small && <span>{card.nameOnCard}</span>}
        <span>{String(card.expMonth).padStart(2, "0")}/{String(card.expYear).slice(-2)}</span>
        <span className="mn-ca-net">{card.network === "visa" ? "VISA" : "mastercard"}</span>
      </div>
      {card.status === "frozen" && <span className="mn-ca-frost"><Icon name="snow" size={small ? 18 : 26} /> Frozen</span>}
    </div>
  );
}

/** Title row for a Money page, with an optional back link and actions. */
export function BankHead({ title, sub, back, actions }: { title: string; sub?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="mn-head">
      {back && <Link className="mn-back" href={back.href}><Icon name="chevL" size={16} />{back.label}</Link>}
      <div className="mn-head-row">
        <div className="mn-head-t">
          <h1>{title}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {actions && <div className="mn-head-acts">{actions}</div>}
      </div>
    </div>
  );
}
