import type { Metadata } from "next";
import Link from "next/link";
import { getSetup } from "@/lib/setup";
import { isOn } from "@/setups/modules";
import { myDeliveryOrders, rows } from "@/api/logistics";
import { CLOSED_STATUSES, UNPAID_STATUSES, customerLabel, dropoffOf, pickupOf, shortAddress, tone, whatOf, whenOf } from "@/modules/logistics/lib/status";
import { jobKind, type ServiceKind } from "@/modules/logistics/lib/services";
import { wordsFor } from "@/modules/logistics/lib/words";
import { getFoodOrders, type FoodRow } from "@/modules/logistics/lib/food";
import { fmtTime, money } from "@/modules/logistics/components/shared/bits";
import { Icon } from "@/modules/logistics/components/shared/icons";
import { LiveRefresh } from "@/modules/logistics/components/shared/live-refresh";
import type { JobEnvelope } from "@/modules/logistics/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `My ${wordsFor(await getSetup()).jobs.toLowerCase()}` };
}

type Row =
  | { t: "job"; at: string; kind: ServiceKind; env: JobEnvelope }
  | { t: "food"; at: string; kind: "food"; f: FoodRow };

const FILTERS: { id: "all" | ServiceKind; label: string }[] = [
  { id: "all", label: "All" }, { id: "ride", label: "Rides" }, { id: "package", label: "Deliveries" }, { id: "food", label: "Food" },
];

/** My trips: rides, deliveries and food orders together, newest first; what's moving
 *  now on top; receipts one tap away; Home / Work for the address fields. */
export default async function MyTripsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [setup, sp] = await Promise.all([getSetup(), searchParams]);
  const w = wordsFor(setup);
  const eat = isOn(setup, "store");
  const [res, food] = await Promise.all([
    myDeliveryOrders({ pageSize: 100 }).catch(() => null),
    eat ? getFoodOrders() : Promise.resolve([] as FoodRow[]),
  ]);
  const jobs = rows<JobEnvelope>(res);
  const all: Row[] = [
    ...jobs.map((env) => ({ t: "job" as const, at: String(env.createdate || ""), kind: jobKind(env.data as any), env })),
    ...(food ?? []).map((f) => ({ t: "food" as const, at: String(f.when || ""), kind: "food" as const, f })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const filters = FILTERS.filter((f) => f.id !== "food" || eat);
  const show = (filters.find((f) => f.id === sp.show)?.id ?? "all") as "all" | ServiceKind;
  const live = all.filter((r): r is Extract<Row, { t: "job" }> => r.t === "job" && !CLOSED_STATUSES.includes(r.env.data.status) && !UNPAID_STATUSES.includes(r.env.data.status));
  const list = all.filter((r) => show === "all" || r.kind === show).filter((r) => !(r.t === "job" && live.includes(r as any)));

  return (
    <div className="mv-acct">
      <LiveRefresh active={live.length > 0} seconds={20} />
      <div className="mv-acct-hd">
        <h1>My {w.jobs.toLowerCase()}</h1>
        <div className="mv-acct-new">
          {eat && <Link className="mv-chip" href="/eat"><Icon name="bag" size={15} />Order food</Link>}
        </div>
      </div>

      {live.length > 0 && (
        <div className="mv-live-list">
          {live.map(({ env }) => {
            const k = jobKind(env.data as any);
            return (
              <Link key={env.sk} href={`/trip/${env.sk}`} className="mv-live-card">
                <span className="mv-live-dot" aria-hidden />
                <span className="mv-live-txt">
                  <small>{k === "ride" ? "Ride" : "Delivery"} in progress</small>
                  <b>{customerLabel(env.data.status, w, k)}</b>
                  <span>To {shortAddress(dropoffOf(env.data))}</span>
                </span>
                <span className="mv-live-go">Track<Icon name="arrow" size={15} /></span>
              </Link>
            );
          })}
        </div>
      )}

      <nav className="mv-filter" aria-label="Show">
        {filters.map((f) => (
          <Link key={f.id} href={f.id === "all" ? "?" : `?show=${f.id}`} className="mv-chip" aria-pressed={show === f.id}>{f.label}</Link>
        ))}
      </nav>

      {res === null ? (
        <div className="mv-empty"><h3>We couldn’t load your {w.jobs.toLowerCase()}</h3><p>Refresh in a moment.</p></div>
      ) : list.length === 0 ? (
        <div className="mv-empty">
          <span className="mv-empty-ic"><Icon name={show === "food" ? "bag" : show === "package" ? "box" : "car"} size={26} /></span>
          <h3>{show === "food" ? "No food orders yet" : show === "package" ? "No deliveries yet" : show === "ride" ? "No rides yet" : `No past ${w.jobs.toLowerCase()} yet`}</h3>
          <p>Everything you book shows up here with its receipt.</p>
          <Link className="mv-btn inline" href={show === "food" ? "/eat" : show === "package" ? "/send" : "/ride"}>{show === "food" ? "Find food" : show === "package" ? "Send a package" : "Request a ride"}</Link>
        </div>
      ) : (
        <ul className="mv-hist">
          {list.map((r) => {
            if (r.t === "food") {
              const f = r.f;
              return (
                <li key={`f-${f.id}`}>
                  <Link href={`/account/orders/${encodeURIComponent(f.orderNumber)}`} className="mv-hist-row">
                    <span className="mv-hist-ic food"><Icon name="bag" size={20} /></span>
                    <span className="mv-hist-txt"><b>{f.title}</b><small>{[fmtTime(f.when), f.items ? `${f.items} item${f.items === 1 ? "" : "s"}` : null, f.status ? f.status.replace(/_/g, " ") : null].filter(Boolean).join(" · ")}</small></span>
                    <span className="mv-hist-amt">{f.total != null ? money(f.total, f.currency) : ""}</span>
                  </Link>
                </li>
              );
            }
            const j = r.env.data;
            const amount = j.payment?.amount ?? j.pricing?.total;
            const refunded = j.cancellation?.refundAmount ?? j.payment?.refund?.amount;
            const s = j.status;
            const k = r.kind;
            const when = whenOf(j);
            return (
              <li key={r.env.sk}>
                <Link href={`/trip/${r.env.sk}`} className="mv-hist-row">
                  <span className={`mv-hist-ic ${k}`}><Icon name={k === "ride" ? "car" : "box"} size={20} /></span>
                  <span className="mv-hist-txt">
                    <b>{shortAddress(dropoffOf(j)) || w.job}</b>
                    <small>{[when ? `Scheduled ${fmtTime(when)}` : fmtTime(r.env.createdate), `from ${shortAddress(pickupOf(j))}`].filter(Boolean).join(" · ")}</small>
                    <small className="mv-hist-what">{whatOf(j)}</small>
                  </span>
                  <span className="mv-hist-amt">
                    {amount ? <span className={s === "cancelled" ? "struck" : ""}>{money(amount, j.payment?.currency || j.pricing?.currency)}</span> : null}
                    <em className={`mv-st ${tone(s)}`}>{s === "cancelled" ? (refunded ? "Refunded" : "Cancelled") : UNPAID_STATUSES.includes(s) ? "Not paid" : customerLabel(s, w, k)}</em>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
