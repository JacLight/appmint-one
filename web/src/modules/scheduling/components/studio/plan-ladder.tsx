import Link from "next/link";
import { money } from "../../lib/format";
import type { Plan } from "../../lib/types";

const term = (p: Plan) => (p.kind === "membership" ? (p.durationUnit === "month" && p.duration === 1 ? "/ month" : `/ ${p.duration} ${p.durationUnit}s`) : "");
const covers = (p: Plan) =>
  p.credits === "unlimited" ? "Unlimited classes" : typeof p.credits === "number" ? `${p.credits} ${p.scope === "private" ? (p.credits === 1 ? "private session" : "private sessions") : p.credits === 1 ? "class" : "classes"}${p.kind === "membership" ? " a month" : ""}` : "";

/** Intro → packs → memberships, as the engine prices them. */
export function PlanLadder({ plans, compact, next }: { plans: Plan[]; compact?: boolean; next?: string }) {
  const order = (p: Plan) => (p.badge && /start/i.test(p.badge) ? 0 : p.scope === "private" ? 3 : p.kind === "pack" ? 1 : 2);
  const sorted = [...plans].sort((a, b) => order(a) - order(b) || a.price - b.price);
  return (
    <div className={`st-ladder${compact ? " compact" : ""}`}>
      {sorted.map((p) => (
        <Link key={p.name} href={`/memberships/${p.name}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={`st-plan${p.badge ? " feat" : ""}`}>
          {p.badge && <span className="st-plan-badge">{p.badge}</span>}
          <span className="st-plan-kind">{p.scope === "private" ? "Private" : p.kind === "membership" ? "Membership" : "Class pack"}</span>
          <span className="st-plan-t">{p.title}</span>
          <span className="st-plan-p"><b>{p.displayPrice || money(p.price, p.currency)}</b> <i>{term(p)}</i></span>
          <span className="st-plan-c">{covers(p)}</span>
          {p.description && <span className="st-plan-d">{p.description}</span>}
          {!compact && p.perks.length > 0 && <ul>{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>}
          <span className="st-plan-go">{p.kind === "membership" ? "Join" : "Buy"}</span>
        </Link>
      ))}
    </div>
  );
}
