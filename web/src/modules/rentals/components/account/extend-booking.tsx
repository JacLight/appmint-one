"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { extendStayAction } from "@/modules/rentals/actions/extend";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";

/** Extend a stay to a new end date. The SERVER checks the space is free for the
 *  extra time, prices it, and charges it — a 402 means "card needed for the extra
 *  time", a 409 means "not free then". Nothing is priced on the client; when a card
 *  is needed we collect one and re-submit, and the server charges the delta. */
export function ExtendBooking({ bookingId, line = 0, currentEnd, currency = "USD", endTime }: { bookingId: string; line?: number; currentEnd?: string; currency?: string;
  /** Optional "HH:MM" the new end lands on (a stay's checkout time). Omitted → the date alone, as Stowbo sends it. */
  endTime?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [endDate, setEndDate] = useState(currentEnd?.slice(0, 10) ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "error" | "ok" | "info"; text: string } | null>(null);
  const [needCard, setNeedCard] = useState(false); // server says the extra time must be paid

  const minDate = currentEnd?.slice(0, 10);

  function submit(paymentMethodId?: string) {
    if (!endDate) { setMsg({ kind: "error", text: "Pick a new end date." }); return; }
    setMsg(null);
    start(async () => {
      const res = await extendStayAction(bookingId, endTime ? `${endDate}T${endTime}:00.000Z` : endDate, line, paymentMethodId);
      if (res.ok) {
        setNeedCard(false); setOpen(false);
        setMsg({ kind: "ok", text: `Extended to ${res.endDate.slice(0, 10)}.` });
        router.refresh();
        return;
      }
      if ("unavailable" in res) {
        setNeedCard(false);
        setMsg({ kind: "error", text: res.message });
        return;
      }
      if ("needsPayment" in res) {
        // Server priced the extra time and needs a card — it states the amount.
        setNeedCard(true);
        setMsg({ kind: res.failed ? "error" : "info", text: res.message });
        return;
      }
      setMsg({ kind: "error", text: res.message });
    });
  }

  if (!open) {
    return <button type="button" className="btn ghost sm" onClick={() => { setOpen(true); setMsg(null); }}>Extend stay</button>;
  }

  return (
    <div className="ext-box">
      <label className="ext-row">
        <span>New end date</span>
        <input type="date" value={endDate} min={minDate} onChange={(e) => { setEndDate(e.target.value); setNeedCard(false); }} />
      </label>
      {msg && <div className={msg.kind === "error" ? "bp-error" : "bp-quote-msg"} style={{ marginTop: 8, ...(msg.kind === "info" ? { textAlign: "left" as const } : {}) }}>{msg.text}</div>}

      {needCard ? (
        <div style={{ marginTop: 8 }}>
          <PaymentStep label="Pay & extend" onPay={(pm) => submit(pm)} busy={pending} />
        </div>
      ) : (
        <button type="button" className="btn clay" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} disabled={pending || !endDate} onClick={() => submit()}>
          {pending ? "Checking…" : "Check & extend"}
        </button>
      )}

      <button type="button" className="bp-release" onClick={() => { setOpen(false); setNeedCard(false); setMsg(null); }}>Cancel</button>
    </div>
  );
}
