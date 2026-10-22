"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEatAddressAction } from "../actions/checkout";
import { Icon } from "./icons";

/** "Deliver to …" — the address every delivery fee and ETA on /eat is quoted to. */
export function EatAddress({ address, label }: { address?: string; label?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!address);
  const [v, setV] = useState(address && !label ? address : "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    setErr(null);
    const r = await setEatAddressAction(v);
    if (!r.ok) { setErr(r.error); return; }
    setEditing(false);
    router.refresh();
  });
  if (!editing) {
    return (
      <button className="ea-addr" onClick={() => setEditing(true)}>
        <Icon name="pin" size={18} />
        <span><small>Deliver to</small><b>{label || address}</b></span>
        <em>Change</em>
      </button>
    );
  }
  return (
    <form className="ea-addr-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <Icon name="pin" size={18} />
      <input autoFocus autoComplete="street-address" value={v} onChange={(e) => setV(e.target.value)} placeholder="Enter delivery address, e.g. 2500 McKinney Ave, Dallas" aria-label="Delivery address" />
      <button className="ea-btn" disabled={pending || v.trim().length < 6}>{pending ? "Saving…" : "Deliver here"}</button>
      {address && <button type="button" className="sf-link" onClick={() => setEditing(false)}>Cancel</button>}
      {err && <p className="sf-err">{err}</p>}
    </form>
  );
}
