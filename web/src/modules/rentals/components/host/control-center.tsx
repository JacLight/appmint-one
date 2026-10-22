"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/alert";
import { routes } from "@/lib/nav";
import { formatMoney } from "@/lib/utils";
import { checkInAction, movementAction, checkOutAction, resolveAction } from "@/modules/rentals/actions/host";
import { HostDrawer } from "@/modules/rentals/components/host/host-drawer";
import { WalkInIntake } from "@/modules/rentals/components/host/walk-in-intake";
import type { HostToday, TodayEntry, Earnings, HostResolveResult, ItemAction } from "@/api/rentals";

type Listing = { sk: string; title: string; spaceType?: string; capacity?: number; name?: string };

function heldSince(v?: string | null) {
  if (!v) return "";
  const ms = Date.now() - new Date(v).getTime();
  if (isNaN(ms) || ms < 0) return "";
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function ControlCenter({ today, listings, earnings }: { today: HostToday; listings: Listing[]; earnings: Earnings | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showBook, setShowBook] = useState(false);

  const titleOf = (name?: string | null) => listings.find((l) => l.name === name)?.title || name || "Space";
  const nameOf = (e: TodayEntry) => e.identifier || e.customer || "Guest";

  const inCare = [...today.inCustody, ...today.departures];
  const dueItems = new Set(today.departures.map((e) => e.item));

  function act(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, key: string) {
    setError(null); setBusy(key);
    start(async () => {
      const r = await fn();
      setBusy(null);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  const total = today.arrivals.length + inCare.length + today.overdue.length;

  return (
    <div>
      <CounterSearch titleOf={titleOf} onActed={() => router.refresh()} />

      <div className="cc-bar">
        <div className="cc-actions">
          <button type="button" className="btn clay sm" onClick={() => setShowBook(true)}>＋ Take a walk-in</button>
          <Link className="btn ghost sm" href={routes.hostListingNew}>＋ Listing</Link>
        </div>
        <div className="cc-pulse">
          <b>{today.arrivals.length}</b> arriving · <b>{inCare.length}</b> in your care{today.overdue.length ? <> · <span className="cc-over"><b>{today.overdue.length}</b> overdue</span></> : null}
        </div>
      </div>

      <HostDrawer open={showBook} title="New walk-in" subtitle="Take someone in at the counter" onClose={() => setShowBook(false)}>
        <WalkInIntake listings={listings} onDone={() => { setShowBook(false); router.refresh(); }} />
      </HostDrawer>
      {error && <div style={{ marginTop: 14 }}><Alert kind="error">{error}</Alert></div>}

      {total === 0 ? (
        <div className="cc-empty">Nothing on the board right now. Walk-ins and today’s arrivals show up here as they happen.</div>
      ) : (
        <div className="cc-board">
          <Lane title="Arriving today" count={today.arrivals.length} tone="clay" empty="No arrivals booked.">
            {today.arrivals.map((e) => (
              <div className="cc-card" key={e.item}>
                <div className="cc-card-top"><span className="cc-who">{nameOf(e)}</span></div>
                <div className="cc-sub">{titleOf(e.listing)}{e.unit ? ` · ${e.unit}` : ""}</div>
                <button type="button" className="btn green xs" disabled={pending} onClick={() => act(() => checkInAction(e.item), e.item)}>
                  {busy === e.item ? "…" : "Check in →"}
                </button>
              </div>
            ))}
          </Lane>

          <Lane title="In your care" count={inCare.length} tone="green" empty="Nothing here right now.">
            {inCare.map((e) => {
              const due = dueItems.has(e.item);
              return (
                <div className={`cc-card${due ? " due" : ""}`} key={e.item}>
                  <div className="cc-card-top"><span className="cc-who">{nameOf(e)}</span>{due && <span className="cc-flag due">leaving today</span>}</div>
                  <div className="cc-sub">{titleOf(e.listing)}{e.unit ? ` · ${e.unit}` : ""}{heldSince(e.checkedInAt || e.startDate) ? ` · ${heldSince(e.checkedInAt || e.startDate)}` : ""}</div>
                  <div className="cc-row2">
                    <button type="button" className="btn ghost xs" disabled={pending} onClick={() => act(() => movementAction(e.item, e.present === false ? "in" : "out"), `${e.item}:o`)} title={e.present === false ? "Return the item to this open storage session" : "Hands it out but keeps the session open — it can come back"}>{busy === `${e.item}:o` ? "…" : e.present === false ? "Bring in" : "Let out"}</button>
                    <button type="button" className="btn clay xs" disabled={pending} onClick={() => act(() => checkOutAction(e.item), `${e.item}:x`)} title="Ends the session and frees the space">{busy === `${e.item}:x` ? "…" : "Check out"}</button>
                  </div>
                </div>
              );
            })}
          </Lane>

          <Lane title="Overdue" count={today.overdue.length} tone="red" empty="All on time.">
            {today.overdue.map((e) => (
              <div className="cc-card over" key={e.item}>
                <div className="cc-card-top"><span className="cc-who">{nameOf(e)}</span><span className="cc-flag over">past due</span></div>
                <div className="cc-sub">{titleOf(e.listing)}{e.unit ? ` · ${e.unit}` : ""}</div>
                <div className="cc-row2">
                  <button type="button" className="btn ghost xs" disabled={pending} onClick={() => act(() => movementAction(e.item, e.present === false ? "in" : "out"), `${e.item}:o`)}>{busy === `${e.item}:o` ? "…" : e.present === false ? "Bring in" : "Let out"}</button>
                  <button type="button" className="btn clay xs" disabled={pending} onClick={() => act(() => checkOutAction(e.item), `${e.item}:x`)}>{busy === `${e.item}:x` ? "…" : "Check out"}</button>
                </div>
              </div>
            ))}
          </Lane>
        </div>
      )}

      <div className="cc-money">
        <div><span className="eyebrow">Settled</span><b>{formatMoney((earnings?.settled ?? 0) * 100, earnings?.currency)}</b></div>
        <div><span className="eyebrow">Pending</span><b>{formatMoney((earnings?.pending ?? 0) * 100, earnings?.currency)}</b></div>
        <div><span className="eyebrow">Spaces</span><b>{listings.length}</b></div>
        <div><span className="eyebrow">Capacity now</span><b>{today.capacity.reduce((n, c) => n + (c.available ?? 0), 0)} free</b></div>
      </div>
    </div>
  );
}

/* ── Counter search — one box, any identifier; each ITEM shows the exact buttons the
      server says are legal right now (checkin / in / out / checkout). ── */
const ACT: Record<ItemAction, { label: string; cls: string }> = {
  checkin: { label: "Check in", cls: "green" },
  in: { label: "Bring in", cls: "green" },
  out: { label: "Let out", cls: "ghost" },
  checkout: { label: "Check out", cls: "clay" },
  charge: { label: "Charge", cls: "ghost" },
};

function CounterSearch({ titleOf, onActed }: { titleOf: (n?: string | null) => string; onActed: () => void }) {
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<HostResolveResult[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function search() {
    setMsg(null);
    if (q.trim().length < 2) { setResults(null); return; }
    start(async () => {
      const r = await resolveAction(q.trim());
      if (r.ok) { setResults(r.result.results); if (!r.result.results.length) setMsg("Nothing matches that."); }
      else setMsg(r.error);
    });
  }

  function run(itemId: string, a: ItemAction) {
    const key = `${itemId}:${a}`;
    setBusy(key); setMsg(null);
    start(async () => {
      const out = a === "checkin" ? await checkInAction(itemId)
        : a === "checkout" ? await checkOutAction(itemId)
        : a === "in" || a === "out" ? await movementAction(itemId, a)
        : { ok: false as const, error: "Open the booking to charge." };
      setBusy(null);
      if (!out.ok) setMsg(out.error);
      else { setResults(null); setQ(""); onActed(); }
    });
  }

  return (
    <div className="cc-search">
      <form onSubmit={(e) => { e.preventDefault(); search(); }}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find anyone — plate, phone, code, or bay" aria-label="Counter search" />
        <button type="submit" className="btn clay sm" disabled={pending || q.trim().length < 2}>{pending ? "…" : "Find"}</button>
      </form>
      {msg && <div className="cc-search-msg">{msg}</div>}
      {results && results.length > 0 && (
        <div className="cc-results">
          {results.flatMap((res) =>
            res.items.map((it) => {
              const acts = it.actions.filter((a) => a !== "charge");
              const where = it.present ? "here now" : it.checkedOutAt ? "checked out" : it.checkedInAt ? "out" : "not in yet";
              return (
                <div className="cc-result" key={it.id}>
                  <div>
                    <b>{it.identifier || res.customer || "Guest"}</b>
                    <span className="cc-result-sub">{titleOf(it.listing)}{it.unit ? ` · ${it.unit}` : ""} · {where}{it.overstaying ? " · overstaying" : ""}</span>
                  </div>
                  <div className="cc-result-acts">
                    {acts.length === 0
                      ? <span className="cc-result-done">done</span>
                      : acts.map((a) => (
                          <button key={a} type="button" className={`btn xs ${ACT[a].cls}`} disabled={pending} onClick={() => run(it.id, a)}>{busy === `${it.id}:${a}` ? "…" : ACT[a].label}</button>
                        ))}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}

function Lane({ title, count, tone, empty, children }: { title: string; count: number; tone: string; empty: string; children: React.ReactNode }) {
  return (
    <div className="cc-lane">
      <div className={`cc-lane-hd ${tone}`}>{title}<span className="cc-count">{count}</span></div>
      <div className="cc-lane-body">{count === 0 ? <div className="cc-lane-empty">{empty}</div> : children}</div>
    </div>
  );
}

