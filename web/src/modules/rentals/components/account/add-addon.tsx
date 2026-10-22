"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBookingAddonAction } from "@/modules/rentals/actions/addon";
import { PaymentStep } from "@/modules/rentals/components/listing/payment-step";
import { formatMoney } from "@/lib/utils";

export interface AddOnOption {
  name: string;
  label: string;
  price: number;
  chargeEvery?: string;
  description?: string;
  service?: boolean;
}

const CADENCE: Record<string, string> = {
  once: "one-time", item: "per item", day: "/ day", week: "/ week", month: "/ month", hour: "/ hour", person: "per person",
};

/** Buy an upgrade on an existing booking. Pick one → pay → the server charges the
 *  card and adds the paid line. A service upgrade also lands in the host's queue to
 *  be fulfilled. The amount is quoted here from the catalog (per-item add-ons ×
 *  quantity, everything else one period) and the SERVER charges exactly that. */
export function AddAddon({ bookingId, options, quantity = 1, currency = "USD" }: {
  bookingId: string; options: AddOnOption[]; quantity?: number; currency?: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "error" | "ok" | "info"; text: string } | null>(null);
  const [needCard, setNeedCard] = useState(false);

  if (!options.length) return null;

  // A free add-on reads "Free" — "$0.00" makes a gift look like a broken price.
  const money = (n: number) => (n > 0 ? formatMoney(Math.round(n * 100), currency) : "Free");
  const amountFor = (a: AddOnOption) => Math.round(a.price * (a.chargeEvery === "item" ? quantity : 1) * 100) / 100;

  function choose(a: AddOnOption) {
    setOpenId(openId === a.name ? null : a.name);
    setNeedCard(false); setMsg(null);
  }

  function pay(a: AddOnOption, paymentMethodId?: string) {
    setMsg(null);
    start(async () => {
      const res = await addBookingAddonAction(bookingId, { name: a.name, label: a.label, amount: amountFor(a), code: a.name }, paymentMethodId);
      if (res.ok) {
        setOpenId(null); setNeedCard(false);
        setMsg({ kind: "ok", text: `${a.label} added${a.service ? " — your host has been asked to set it up." : "."}` });
        router.refresh();
        return;
      }
      if ("needsPayment" in res) { setNeedCard(true); setMsg({ kind: res.failed ? "error" : "info", text: res.message }); return; }
      setMsg({ kind: "error", text: res.message });
    });
  }

  return (
    <div className="tcard bkd-card addon-card">
      <h3>Add an upgrade</h3>
      <p className="addon-intro">Extras your host offers on this space. Pay now — a service upgrade goes straight to your host to set up.</p>
      {msg && <div className={msg.kind === "error" ? "bp-error" : "set-ok"} style={{ marginBottom: 10 }}>{msg.text}</div>}
      <div className="addon-list">
        {options.map((a) => {
          const active = openId === a.name;
          return (
            <div className={`addon-opt${active ? " open" : ""}`} key={a.name}>
              <button type="button" className="addon-opt-head" onClick={() => choose(a)} aria-expanded={active}>
                <span className="addon-opt-main">
                  <span className="addon-opt-name">{a.label}{a.service && <span className="addon-svc" title="Your host sets this up">service</span>}</span>
                  {a.description && <span className="addon-opt-desc">{a.description}</span>}
                </span>
                <span className="addon-opt-price">{money(a.price)}<em>{a.price > 0 ? (CADENCE[a.chargeEvery ?? "once"] ?? "") : ""}</em></span>
              </button>
              {active && (
                <div className="addon-opt-body">
                  <div className="addon-charge"><span>{amountFor(a) > 0 ? "You’ll be charged now" : "Nothing to pay"}</span><b>{money(amountFor(a))}</b></div>
                  {needCard ? (
                    <PaymentStep label={`Pay ${money(amountFor(a))} & add`} onPay={(pm) => pay(a, pm)} busy={pending} />
                  ) : (
                    <button type="button" className="btn clay" style={{ width: "100%", justifyContent: "center" }} disabled={pending} onClick={() => pay(a)}>
                      {pending ? "Adding…" : amountFor(a) > 0 ? `Add — ${money(amountFor(a))}` : "Add — free"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
