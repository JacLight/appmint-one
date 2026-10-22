"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAddonAction, deleteAddonAction, setListingAddonsAction } from "@/modules/rentals/actions/addons-host";
import { formatMoney } from "@/lib/utils";
import type { StowboAddOn } from "@/api/rentals";
import type { Envelope } from "@/lib/api";

const CADENCE: { k: string; label: string }[] = [
  { k: "once", label: "One-time" },
  { k: "item", label: "Per item" },
  { k: "day", label: "Per day" },
  { k: "week", label: "Per week" },
  { k: "month", label: "Per month" },
];

/** The host's own extras: define them once, then tick which apply to this space.
 *  Leave the price at 0 for a free add-on. Mark "I do this" when the host physically
 *  performs it — those raise a fulfilment request in the custody console when bought. */
export function AddonsPanel({ listingId, mine, attached }: {
  listingId: string;
  mine: Envelope<StowboAddOn>[];
  attached: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ label: "", description: "", price: "", chargeEvery: "once", service: false });
  const [on, setOn] = useState<string[]>(attached ?? []);

  const money = (n: number) => (n > 0 ? formatMoney(Math.round(n * 100), "USD") : "Free");

  function create() {
    setMsg(null);
    start(async () => {
      const r = await createAddonAction({
        label: f.label, description: f.description,
        price: Number(f.price || 0), chargeEvery: f.chargeEvery, service: f.service,
      });
      if (r.ok) {
        setF({ label: "", description: "", price: "", chargeEvery: "once", service: false });
        setOpen(false);
        setMsg({ kind: "ok", text: "Add-on created." });
        router.refresh();
      } else setMsg({ kind: "err", text: r.error });
    });
  }

  function toggle(name: string) {
    const next = on.includes(name) ? on.filter((n) => n !== name) : [...on, name];
    setOn(next);
    start(async () => {
      const r = await setListingAddonsAction(listingId, next);
      if (!r.ok) { setOn(on); setMsg({ kind: "err", text: r.error }); }
      else router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await deleteAddonAction(id);
      if (r.ok) { setMsg({ kind: "ok", text: "Add-on retired." }); router.refresh(); }
      else setMsg({ kind: "err", text: r.error });
    });
  }

  return (
    <div className="ao-panel">
      <div className="ao-head">
        <div>
          <h3>Add-ons for this space</h3>
          <p className="ao-sub">Extras guests can buy with a booking, or add later. Tick the ones this space offers. Price 0 = free.</p>
        </div>
        <button type="button" className="btn clay sm" onClick={() => { setOpen(!open); setMsg(null); }}>
          {open ? "Cancel" : "+ New add-on"}
        </button>
      </div>

      {msg && <div className={msg.kind === "ok" ? "set-ok" : "bp-error"} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {open && (
        <div className="ao-form">
          <div className="ao-row2">
            <label className="set-field"><span>Name</span>
              <input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Insurance cover" /></label>
            <label className="set-field"><span>Price <em>(0 = free)</em></span>
              <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="0.00" inputMode="decimal" /></label>
          </div>
          <div className="ao-row2">
            <label className="set-field"><span>Charged</span>
              <select value={f.chargeEvery} onChange={(e) => setF({ ...f, chargeEvery: e.target.value })}>
                {CADENCE.map((c) => <option key={c.k} value={c.k}>{c.label}</option>)}
              </select></label>
            <label className="set-field ao-check">
              <input type="checkbox" checked={f.service} onChange={(e) => setF({ ...f, service: e.target.checked })} />
              <span>I do this myself <em>(shows in your requests queue when bought)</em></span>
            </label>
          </div>
          <label className="set-field"><span>Description</span>
            <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What the guest gets." /></label>
          <button type="button" className="btn clay" disabled={pending || !f.label.trim()} onClick={create}>
            {pending ? "Saving…" : "Create add-on"}
          </button>
        </div>
      )}

      {mine.length === 0 ? (
        <div className="ao-empty">
          <p>You haven’t created any add-ons yet.</p>
          <p className="muted">Insurance, priority retrieval, a padlock, EV charging — anything extra you offer.</p>
        </div>
      ) : (
        <div className="ao-list">
          {mine.map((e) => {
            const a = e.data ?? ({} as StowboAddOn);
            const active = on.includes(a.name);
            return (
              <div className={`ao-item${active ? " on" : ""}`} key={e.sk}>
                <label className="ao-pick">
                  <input type="checkbox" checked={active} disabled={pending} onChange={() => toggle(a.name)} />
                  <span className="ao-main">
                    <b>{a.title || a.label || a.name}
                      {a.service && <span className="addon-svc">service</span>}
                      {!(a.price && a.price > 0) && <span className="ao-free">free</span>}
                    </b>
                    {a.description && <span className="ao-desc">{a.description}</span>}
                  </span>
                </label>
                <div className="ao-right">
                  <span className="ao-price">{money(Number(a.price ?? 0))}<em>{a.chargeEvery && a.chargeEvery !== "once" ? `/ ${a.chargeEvery}` : ""}</em></span>
                  <button type="button" className="ao-del" disabled={pending} onClick={() => remove(e.sk)} title="Retire this add-on">Remove</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
